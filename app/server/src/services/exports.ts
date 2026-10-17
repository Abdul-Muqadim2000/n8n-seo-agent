import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import {
  bigQuerySchema,
  decodeCursor,
  exportColumns,
  exportDestinationPatchSchema,
  exportDestinationSchema,
  exportObjectKey,
  exportRow,
  exportTable,
  EXPORTS,
  EXPORT_KINDS,
  nextExportAt,
  pageLimit,
  pageOf,
  storageEndpoint,
  toCsv,
  toNdjson,
  type ExportTable,
  type PageV1,
  type StorageProvider,
} from '@seo/shared';
import { db, schema } from '../db';
import type { IntegrationRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { HttpError, notFound, parse } from '../lib/errors';
import { serviceAccountToken, type ServiceAccountKey } from '../lib/googleSa';
import { outbound, safeError, type OutResponse } from '../lib/netGuard';
import { seal, unseal } from '../lib/secretBox';
import { encodeRfc3986, sha256Hex, signRequest } from '../lib/sigv4';
import { siteRows } from '../n8n/client';
import { integrationOf, requireSecrets, toExportRunView, toIntegrationView } from './integrations';

/**
 * G4 (2026-10-17) — the warehouse / BI export. Design note: app/docs/INTEGRATIONS.md §6.
 *
 * Six tables (`EXPORT_TABLES`, one documented schema in shared/src/integrations.ts) leave the app as a full snapshot per run:
 *  - to S3-compatible storage as NDJSON or CSV, one object per table, `<prefix>/<table>/dt=YYYY-MM-DD/<table>-<run>.<ext>`, signed
 *    with SigV4 (lib/sigv4.ts) — AWS S3 (virtual-hosted), Google Cloud Storage's XML API with HMAC keys, Cloudflare R2 (path-style);
 *    https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
 *  - to BigQuery with a resumable-upload load job, NEWLINE_DELIMITED_JSON, the documented schema, WRITE_TRUNCATE (a re-run replaces,
 *    never duplicates); https://cloud.google.com/bigquery/docs/reference/api-uploads ,
 *    https://cloud.google.com/bigquery/docs/reference/rest/v2/Job#JobConfigurationLoad
 * The rows are read the way the dashboards read them: the n8n Data Tables filtered by each VERIFIED website's domain (a verified domain
 * belongs to one company), the app's own `runs` by company id. The same rows answer `GET /api/v1/websites/:id/tables/:table`.
 */

type Log = { info: (o: object, m: string) => void; error: (o: object, m: string) => void };
type Cfg = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

// ---------------------------------------------------------------------------------------------------------------------------
// reading the rows
// ---------------------------------------------------------------------------------------------------------------------------

type Out = Record<string, string | number | boolean | null>;

async function siteTableRows(org: Pick<OrgRow, 'id'>, site: SiteRow, t: ExportTable, max: number, exportedAt: string): Promise<Out[]> {
  const common = { companyId: org.id, websiteId: site.id, websiteDomain: site.domain, exportedAt };
  if (t.source === 'runs') {
    const rows = await db
      .select()
      .from(schema.runs)
      .where(and(eq(schema.runs.orgId, org.id), eq(schema.runs.siteId, site.id)))
      .orderBy(desc(schema.runs.createdAt))
      .limit(max);
    return rows.map((r) => exportRow(t, runRow(r), common));
  }
  const rows = await siteRows<Record<string, unknown>>(t.source, site.domain, { max, sortBy: `${t.dateColumn}:asc` });
  return rows.map((r) => exportRow(t, r, common));
}

const runRow = (r: typeof schema.runs.$inferSelect): Record<string, unknown> => ({
  run_id: r.id,
  mode: r.mode,
  title: r.title,
  status: r.status,
  started_by: r.apiKeyId ? 'api_key' : (r.input as Record<string, unknown>)?.autoStart === true ? 'auto' : 'person',
  created_at: r.createdAt,
  completed_at: r.completedAt,
  estimated_cost_usd: r.estimatedCostUsd,
  actual_cost_usd: r.actualCostUsd,
  cost_estimated: r.actualCostEstimated,
  cost_partial: r.actualCostPartial,
  report_count: r.reportCount,
  error: r.error,
});

/** Every row of one table for the whole company (its verified websites; runs also without a website). */
async function companyRows(org: OrgRow, t: ExportTable, exportedAt: string): Promise<{ rows: Out[]; truncated: boolean }> {
  const sites = await db.select().from(schema.sites).where(and(eq(schema.sites.orgId, org.id), isNotNull(schema.sites.verifiedAt)));
  const max = EXPORTS.maxRowsPerTable;
  const out: Out[] = [];
  for (const site of sites) {
    if (out.length > max) break;
    out.push(...(await siteTableRows(org, site, t, max + 1 - out.length, exportedAt)));
  }
  if (t.source === 'runs' && out.length <= max) {
    const rows = await db
      .select()
      .from(schema.runs)
      .where(and(eq(schema.runs.orgId, org.id), sql`${schema.runs.siteId} is null`))
      .orderBy(desc(schema.runs.createdAt))
      .limit(max + 1 - out.length);
    out.push(...rows.map((r) => exportRow(t, runRow(r), { companyId: org.id, websiteId: null, websiteDomain: null, exportedAt })));
  }
  return { rows: out.slice(0, max), truncated: out.length > max };
}

/** `GET /api/v1/websites/:id/tables/:table` — one website's rows in the export schema, oldest first, filterable by date. */
export async function tableRowsV1(org: Pick<OrgRow, 'id'>, site: SiteRow, table: unknown, q: Record<string, unknown>): Promise<PageV1<Out> & { table: string; columns: { name: string; type: string; description: string }[] }> {
  const t = exportTable(table);
  if (!t) throw notFound('Unknown table: use one of rank_history, site_metrics, audit_findings, ai_visibility, backlinks, runs');
  if (!site.verifiedAt) throw new HttpError(403, `Verify that you own ${site.domain} in the app before its data can be read`, 'website_unverified');
  const since = typeof q.since === 'string' && !Number.isNaN(Date.parse(q.since)) ? new Date(q.since).toISOString() : null;
  const until = typeof q.until === 'string' && !Number.isNaN(Date.parse(q.until)) ? new Date(q.until).toISOString() : null;
  let rows = await siteTableRows(org, site, t, EXPORTS.maxRowsPerTable, new Date().toISOString());
  if (t.source === 'runs') rows = rows.reverse();
  if (since || until)
    rows = rows.filter((r) => {
      const d = s(r[t.dateColumn]);
      if (!d) return false;
      const iso = d.length === 10 ? d + 'T00:00:00.000Z' : d;
      return (!since || iso >= since) && (!until || iso <= until);
    });
  const page = pageOf(rows, decodeCursor(q.cursor), q.limit == null ? 100 : pageLimit(q.limit));
  return { table: t.id, columns: exportColumns(t).map((c) => ({ ...c })), ...page };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the two destinations
// ---------------------------------------------------------------------------------------------------------------------------

interface S3Cfg {
  provider: StorageProvider;
  region: string;
  accountId: string;
  endpoint: string;
  bucket: string;
  prefix: string;
  format: 'ndjson' | 'csv';
}
interface S3Secret {
  accessKeyId: string;
  secretAccessKey: string;
}

/** The object's URL: virtual-hosted for AWS (`<bucket>.s3.<region>.amazonaws.com`), path-style elsewhere. */
export function objectUrl(c: S3Cfg, key: string): string {
  const base = storageEndpoint(c);
  if (!base) throw new HttpError(400, 'The storage endpoint is not valid', 'validation');
  const path = encodeRfc3986(key, true);
  return c.provider === 'aws' ? base.replace('https://', `https://${c.bucket}.`) + '/' + path : `${base}/${c.bucket}/${path}`;
}
const signingRegion = (c: S3Cfg) => (c.provider === 'aws' ? c.region : c.region && c.region !== '' ? c.region : 'auto');

export async function putObject(c: S3Cfg, sec: S3Secret, key: string, body: Buffer, contentType: string): Promise<void> {
  const url = objectUrl(c, key);
  const headers = signRequest({ method: 'PUT', url, region: signingRegion(c), accessKeyId: sec.accessKeyId, secretAccessKey: sec.secretAccessKey, payloadHash: sha256Hex(body), headers: { 'content-type': contentType } });
  let res: OutResponse;
  try {
    res = await outbound({ url, method: 'PUT', headers: { ...headers, 'content-length': String(body.length) }, body, timeoutMs: 120_000, maxBytes: 64 * 1024 });
  } catch (err) {
    throw new HttpError(502, `The storage could not be reached: ${safeError(err)}`, 'export_unreachable');
  }
  if (res.status < 200 || res.status >= 300) {
    const code = res.text.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? '';
    const msg = res.text.match(/<Message>([^<]+)<\/Message>/)?.[1] ?? '';
    throw new HttpError(502, `The storage answered ${res.status}${code ? ` ${code}` : ''}${msg ? `: ${msg.slice(0, 200)}` : ''}`, 'export_refused');
  }
}

interface BqCfg {
  projectId: string;
  datasetId: string;
  location: string;
  tablePrefix: string;
}
const BQ = 'https://bigquery.googleapis.com';
const BQ_SCOPE = 'https://www.googleapis.com/auth/bigquery';

async function bq(token: string, req: { url: string; method: 'GET' | 'POST' | 'PUT'; body?: string | Buffer; headers?: Record<string, string> }): Promise<OutResponse> {
  try {
    return await outbound({ ...req, headers: { authorization: `Bearer ${token}`, ...(req.headers ?? {}) }, timeoutMs: 120_000, maxBytes: 1024 * 1024 });
  } catch (err) {
    throw new HttpError(502, `BigQuery could not be reached: ${safeError(err)}`, 'export_unreachable');
  }
}
const bqError = (res: OutResponse, what: string) => {
  let m = '';
  try {
    m = s((JSON.parse(res.text) as { error?: { message?: string } }).error?.message);
  } catch {
    m = res.text.slice(0, 160);
  }
  return new HttpError(502, `BigQuery ${what} failed (${res.status}${m ? `: ${m.slice(0, 240)}` : ''})`, 'export_refused');
};

/** One load job: a resumable upload session with the job configuration, then the data, then wait until it is DONE. */
export async function loadIntoBigQuery(c: BqCfg, key: ServiceAccountKey, t: ExportTable, ndjson: Buffer, opts: { pollMs?: number; maxPolls?: number } = {}): Promise<string> {
  const token = await serviceAccountToken(key, BQ_SCOPE);
  const jobId = `ascentra_${t.id}_${randomUUID().replace(/-/g, '')}`;
  const job = {
    jobReference: { projectId: c.projectId, jobId, location: c.location },
    configuration: {
      load: {
        destinationTable: { projectId: c.projectId, datasetId: c.datasetId, tableId: `${c.tablePrefix}${t.id}` },
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        schema: bigQuerySchema(t),
        writeDisposition: 'WRITE_TRUNCATE',
        createDisposition: 'CREATE_IF_NEEDED',
        ignoreUnknownValues: false,
      },
    },
  };
  const start = await bq(token, {
    url: `${BQ}/upload/bigquery/v2/projects/${encodeURIComponent(c.projectId)}/jobs?uploadType=resumable`,
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'application/octet-stream', 'x-upload-content-length': String(ndjson.length) },
    body: JSON.stringify(job),
  });
  const session = start.headers.location;
  if (start.status !== 200 || !session || !/^https:\/\/bigquery\.googleapis\.com\//.test(session)) throw bqError(start, 'upload session');
  const up = await bq(token, { url: session, method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: ndjson });
  if (up.status !== 200 && up.status !== 201) throw bqError(up, 'upload');
  const pollMs = opts.pollMs ?? 2000;
  for (let i = 0; i < (opts.maxPolls ?? 90); i++) {
    const r = await bq(token, { url: `${BQ}/bigquery/v2/projects/${encodeURIComponent(c.projectId)}/jobs/${jobId}?location=${encodeURIComponent(c.location)}`, method: 'GET' });
    if (r.status !== 200) throw bqError(r, 'job status');
    const j = JSON.parse(r.text) as { status?: { state?: string; errorResult?: { message?: string; reason?: string } } };
    if (j.status?.state === 'DONE') {
      if (j.status.errorResult) throw new HttpError(502, `BigQuery refused the load of ${t.id}: ${s(j.status.errorResult.message).slice(0, 240)}`, 'export_refused');
      return jobId;
    }
    if (pollMs) await new Promise((res) => setTimeout(res, pollMs));
  }
  throw new HttpError(504, `BigQuery did not finish loading ${t.id} in time; the job ${jobId} may still complete`, 'export_timeout');
}

// ---------------------------------------------------------------------------------------------------------------------------
// connecting, testing, changing
// ---------------------------------------------------------------------------------------------------------------------------

const secretOf = (row: IntegrationRow): Cfg => {
  try {
    return JSON.parse(unseal(row.secret)) as Cfg;
  } catch {
    throw new HttpError(409, 'The stored credentials cannot be read any more (the server key changed). Connect the destination again.', 'secret_unreadable');
  }
};

async function verify(kind: 's3' | 'bigquery', cfg: Cfg, secret: Cfg): Promise<Cfg> {
  if (kind === 's3') {
    const c = cfg as unknown as S3Cfg;
    const key = exportObjectKey(c.prefix, '_ascentra', 'connection-test', new Date(), 'ndjson').replace(/\.ndjson$/, '.txt');
    await putObject(c, secret as unknown as S3Secret, key, Buffer.from(`Ascentra connection test ${new Date().toISOString()}\n`), 'text/plain; charset=utf-8');
    return { testObject: key };
  }
  const c = cfg as unknown as BqCfg;
  const token = await serviceAccountToken(secret as unknown as ServiceAccountKey, BQ_SCOPE).catch((e) => {
    throw new HttpError(400, s((e as Error).message), 'validation', { serviceAccountJson: 'Refused by Google' });
  });
  const r = await bq(token, { url: `${BQ}/bigquery/v2/projects/${encodeURIComponent(c.projectId)}/datasets/${encodeURIComponent(c.datasetId)}`, method: 'GET' });
  if (r.status === 404) throw new HttpError(400, `The dataset ${c.projectId}.${c.datasetId} does not exist, or the service account cannot see it.`, 'validation', { datasetId: 'Not found' });
  if (r.status !== 200) throw bqError(r, 'dataset check');
  const loc = s((JSON.parse(r.text) as { location?: string }).location);
  return loc ? { location: loc } : {};
}

export async function connectExport(org: OrgRow, user: UserRow, body: unknown) {
  const b = parse(exportDestinationSchema, body);
  requireSecrets();
  const n = await db.select({ n: sql<number>`count(*)::int` }).from(schema.integrations).where(and(eq(schema.integrations.orgId, org.id), inArray(schema.integrations.kind, [...EXPORT_KINDS])));
  if (Number(n[0]?.n ?? 0) >= EXPORTS.maxDestinations) throw new HttpError(409, `A company can have ${EXPORTS.maxDestinations} export destinations. Remove one first.`, 'export_limit');
  let cfg: Cfg;
  let secret: Cfg;
  let hint: string;
  if (b.kind === 's3') {
    const { accessKeyId, secretAccessKey, kind: _k, name: _n, ...rest } = b;
    cfg = rest;
    secret = { accessKeyId, secretAccessKey };
    hint = `key ${accessKeyId.slice(0, 4)}…${accessKeyId.slice(-4)}`;
  } else {
    const { serviceAccountJson, kind: _k, name: _n, ...rest } = b;
    cfg = { ...rest, serviceAccount: serviceAccountJson.client_email };
    secret = { client_email: serviceAccountJson.client_email, private_key: serviceAccountJson.private_key, project_id: serviceAccountJson.project_id };
    hint = `key of ${serviceAccountJson.client_email}`;
  }
  const checked = await verify(b.kind, cfg, secret).catch((e) => {
    if (e instanceof HttpError && e.statusCode >= 500) throw new HttpError(400, e.message, 'export_test_failed');
    throw e;
  });
  const now = new Date();
  const [row] = await db
    .insert(schema.integrations)
    .values({
      orgId: org.id,
      kind: b.kind,
      name: b.name,
      config: { ...cfg, ...checked },
      secret: seal(JSON.stringify(secret)),
      secretHint: hint,
      status: 'ok',
      lastCheckedAt: now,
      nextRunAt: nextExportAt({ schedule: b.schedule, hour: b.hour, weekday: b.weekday }, now),
      createdBy: user.id,
    })
    .returning();
  return toIntegrationView(row);
}

export async function updateExport(orgId: string, id: unknown, body: unknown) {
  const row = await exportOf(orgId, id);
  const v = parse(exportDestinationPatchSchema, body ?? {});
  const cfg = { ...row.config, ...Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== undefined && k !== 'name')) };
  const [saved] = await db
    .update(schema.integrations)
    .set({
      config: cfg,
      ...(v.name ? { name: v.name } : {}),
      nextRunAt: nextExportAt({ schedule: s(cfg.schedule), hour: Number(cfg.hour) || 0, weekday: Number(cfg.weekday) || 0 }, new Date()),
      updatedAt: new Date(),
    })
    .where(eq(schema.integrations.id, row.id))
    .returning();
  return toIntegrationView(saved);
}

async function exportOf(orgId: string, id: unknown): Promise<IntegrationRow> {
  const row = await integrationOf(orgId, id);
  if (row.kind !== 's3' && row.kind !== 'bigquery') throw notFound('Export destination not found');
  return row;
}

export async function testExport(orgId: string, id: unknown) {
  const row = await exportOf(orgId, id);
  try {
    await verify(row.kind as 's3' | 'bigquery', row.config, secretOf(row));
    await db.update(schema.integrations).set({ status: 'ok', lastError: '', lastCheckedAt: new Date() }).where(eq(schema.integrations.id, row.id));
    return { ok: true, error: '' };
  } catch (e) {
    const msg = s((e as Error).message).slice(0, 300);
    await db.update(schema.integrations).set({ status: 'error', lastError: msg, lastCheckedAt: new Date() }).where(eq(schema.integrations.id, row.id));
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// one export
// ---------------------------------------------------------------------------------------------------------------------------

export async function runExport(orgId: string, id: unknown, trigger: 'schedule' | 'manual') {
  const row = await exportOf(orgId, id);
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw notFound('Company not found');
  // one export of a destination at a time; "Run now" at most once per 10 minutes
  const recent = await db.query.exportRuns.findFirst({ where: eq(schema.exportRuns.integrationId, row.id), orderBy: desc(schema.exportRuns.startedAt) });
  if (recent?.status === 'running' && Date.now() - recent.startedAt.getTime() < EXPORTS.staleRunMinutes * 60_000) throw new HttpError(409, 'An export of this destination is running now', 'export_running');
  if (trigger === 'manual' && recent && Date.now() - recent.startedAt.getTime() < EXPORTS.manualEveryMinutes * 60_000)
    throw new HttpError(429, `This destination was exported less than ${EXPORTS.manualEveryMinutes} minutes ago. Try again in a few minutes.`, 'rate_limited');
  const now = new Date();
  const [run] = await db.insert(schema.exportRuns).values({ orgId, integrationId: row.id, trigger, status: 'running' }).returning();
  await db
    .update(schema.integrations)
    .set({ lastRunAt: now, nextRunAt: nextExportAt({ schedule: s(row.config.schedule), hour: Number(row.config.hour) || 0, weekday: Number(row.config.weekday) || 0 }, now) })
    .where(eq(schema.integrations.id, row.id));

  const secret = secretOf(row);
  const tables = (Array.isArray(row.config.tables) ? row.config.tables : []).map(exportTable).filter((t): t is ExportTable => !!t);
  const results: { table: string; rows: number; bytes: number; object: string; truncated: boolean; error: string }[] = [];
  const exportedAt = now.toISOString();
  for (const t of tables) {
    try {
      const { rows, truncated } = await companyRows(org, t, exportedAt);
      const csv = row.kind === 's3' && s(row.config.format) === 'csv';
      const body = Buffer.from(csv ? toCsv(exportColumns(t), rows) : toNdjson(rows), 'utf8');
      if (body.length > EXPORTS.maxObjectBytes) throw new HttpError(413, `${t.id} is larger than ${EXPORTS.maxObjectBytes / 1024 / 1024} MB`, 'too_large');
      let object: string;
      if (row.kind === 's3') {
        const c = row.config as unknown as S3Cfg;
        object = exportObjectKey(c.prefix, t.id, run.id, now, csv ? 'csv' : 'ndjson');
        await putObject(c, secret as unknown as S3Secret, object, body, csv ? 'text/csv; charset=utf-8' : 'application/x-ndjson');
      } else {
        object = await loadIntoBigQuery(row.config as unknown as BqCfg, secret as unknown as ServiceAccountKey, t, body);
      }
      results.push({ table: t.id, rows: rows.length, bytes: body.length, object, truncated, error: '' });
    } catch (e) {
      results.push({ table: t.id, rows: 0, bytes: 0, object: '', truncated: false, error: s((e as Error).message).slice(0, 300) });
    }
  }
  const failed = results.filter((r) => r.error).length;
  const status = !failed ? 'ok' : failed === results.length ? 'failed' : 'partial';
  const [done] = await db
    .update(schema.exportRuns)
    .set({ status, tables: results, finishedAt: new Date(), error: failed ? results.find((r) => r.error)!.error : '' })
    .where(eq(schema.exportRuns.id, run.id))
    .returning();
  await db
    .update(schema.integrations)
    .set({ status: status === 'failed' ? 'error' : 'ok', lastError: status === 'ok' ? '' : done.error, lastCheckedAt: new Date() })
    .where(eq(schema.integrations.id, row.id));
  return toExportRunView(done);
}

/** Every five minutes: the destinations whose scheduled export is due (their next time is moved on before the export starts). */
export async function exportTick(log: Log, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: schema.integrations.id, orgId: schema.integrations.orgId })
    .from(schema.integrations)
    .innerJoin(schema.organizations, eq(schema.integrations.orgId, schema.organizations.id))
    .where(and(inArray(schema.integrations.kind, [...EXPORT_KINDS]), lte(schema.integrations.nextRunAt, now), eq(schema.organizations.disabled, false)))
    .limit(10);
  let n = 0;
  for (const d of due) {
    try {
      const r = await runExport(d.orgId, d.id, 'schedule');
      log.info({ org: d.orgId, destination: d.id, status: r.status }, 'scheduled export');
      n++;
    } catch (err) {
      log.error({ org: d.orgId, destination: d.id, err: safeError(err) }, 'scheduled export failed');
      // never retried in a loop: the next time is the schedule's next time
      await db.update(schema.integrations).set({ nextRunAt: new Date(now.getTime() + 60 * 60_000) }).where(and(eq(schema.integrations.id, d.id), lte(schema.integrations.nextRunAt, now)));
    }
  }
  return n;
}

export async function listExportRuns(orgId: string, integrationId?: string) {
  const conds = [eq(schema.exportRuns.orgId, orgId)];
  if (integrationId) conds.push(eq(schema.exportRuns.integrationId, integrationId));
  const rows = await db.select().from(schema.exportRuns).where(and(...conds)).orderBy(desc(schema.exportRuns.startedAt)).limit(30);
  return rows.map(toExportRunView);
}

