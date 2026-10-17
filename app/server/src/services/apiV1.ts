import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import {
  costBasisV1,
  decodeCursor,
  deliveryDecision,
  encodeCursor,
  filterFindings,
  findingsV1,
  MODE_IDS,
  pageLimit,
  pageOf,
  publishCheckSchema,
  runCostEstimate,
  type ApiScope,
  type AuditDetailV1,
  type AuditFindingRow,
  type AuditRow,
  type AuditV1,
  type ModeId,
  type PageV1,
  type PublishCheckResult,
  type ReportV1,
  type RunV1,
  type WebsiteV1,
} from '@seo/shared';
import { db, schema } from '../db';
import type { ApiKeyRow, OrgRow, RunRow, SiteRow } from '../db/schema';
import { isUuid, type OrgAccess } from '../auth/access';
import { HttpError, notFound, validationError } from '../lib/errors';
import { publishCheckCall, siteRows } from '../n8n/client';
import { oneReadingFinding, previousOfType } from './data';
import { filesFor } from './runs';

/**
 * B5-11 / area 12 G-5 (v4.18): the handlers of the read API. Design note: app/API.md "Read API v1".
 *
 * Every handler takes a `V1Ctx` that names ONE company, resolved from the API key (or the session + membership) before the handler
 * runs, and every query below carries `org_id = ctx.org.id`. A website / run / report / file of another company is therefore not
 * found — the same 404 as one that does not exist. The n8n Data Tables are keyed by domain, so they are read only for a website this
 * company verified (a verified domain belongs to one company). The REST routes and the MCP tools both call these functions.
 */

export interface V1Ctx {
  org: OrgRow;
  auth: 'api_key' | 'session';
  key: ApiKeyRow | null;
  scopes: ApiScope[];
  /** G4: a session's own membership (a key's actor is its creator, resolved per write in services/apiRuns.ts `actorOf`) */
  actor?: OrgAccess | null;
}

export function requireScope(ctx: V1Ctx, scope: ApiScope) {
  if (!ctx.scopes.includes(scope))
    throw new HttpError(403, ctx.auth === 'api_key' ? `This API key does not have the "${scope}" permission` : 'Your role cannot do this', 'scope_missing');
}

type Q = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ---------------- keyset pages over the app's own tables ----------------

/** created_at to the millisecond (what a JS Date carries), then id: the order and the cursor agree exactly */
/** (postgres-js takes no JS Date inside a raw sql template: the cursor's time goes in as ISO text) */
function keyset(col: SQL | ReturnType<typeof sql>, idCol: unknown, cursor: ReturnType<typeof decodeCursor>): SQL | null {
  if (!cursor || !('t' in cursor)) return null;
  return sql`(date_trunc('milliseconds', ${col}), ${idCol}) < (${new Date(cursor.t).toISOString()}::timestamptz, ${cursor.id}::uuid)`;
}
const ms = (col: unknown) => sql`date_trunc('milliseconds', ${col})`;

function nextCursor<T extends { id: string }>(rows: T[], limit: number, at: (r: T) => Date): string | null {
  return rows.length > limit ? encodeCursor({ t: at(rows[limit - 1]).toISOString(), id: rows[limit - 1].id }) : null;
}

// ---------------- websites ----------------

export const toWebsite = (s: SiteRow): WebsiteV1 => ({
  id: s.id,
  domain: s.domain,
  country: s.country,
  verified: !!s.verifiedAt,
  verifiedAt: s.verifiedAt ? s.verifiedAt.toISOString() : null,
  trackingStatus: s.trackingStatus,
  createdAt: s.createdAt.toISOString(),
});

export async function listWebsites(ctx: V1Ctx, q: Q = {}): Promise<PageV1<WebsiteV1>> {
  const limit = pageLimit(q.limit);
  const conds: SQL[] = [eq(schema.sites.orgId, ctx.org.id)];
  const k = keyset(schema.sites.createdAt as never, schema.sites.id, decodeCursor(q.cursor));
  if (k) conds.push(k);
  const rows = await db
    .select()
    .from(schema.sites)
    .where(and(...conds))
    .orderBy(desc(ms(schema.sites.createdAt)), desc(schema.sites.id))
    .limit(limit + 1);
  return { items: rows.slice(0, limit).map(toWebsite), nextCursor: nextCursor(rows, limit, (r) => r.createdAt) };
}

/** A website of THIS company, or 404 (another company's website is simply not there). */
export async function siteOf(ctx: V1Ctx, websiteId: unknown): Promise<SiteRow> {
  if (!isUuid(websiteId)) throw notFound('Website not found');
  const site = await db.query.sites.findFirst({ where: and(eq(schema.sites.id, websiteId), eq(schema.sites.orgId, ctx.org.id)) });
  if (!site) throw notFound('Website not found');
  return site;
}

export async function getWebsite(ctx: V1Ctx, websiteId: unknown): Promise<WebsiteV1> {
  return toWebsite(await siteOf(ctx, websiteId));
}

function requireVerifiedSite(site: SiteRow) {
  if (!site.verifiedAt) throw new HttpError(403, `Verify that you own ${site.domain} in the app before its audits can be read`, 'website_unverified');
}

// ---------------- audits and findings (n8n Data Tables, the verified domain only) ----------------

const toAuditV1 = (r: AuditRow): AuditV1 => ({
  id: str(r.audit_id),
  auditedAt: str(r.audited_at),
  reportType: str(r.report_type),
  healthScore: num(r.health_score),
  grade: str(r.grade),
  pagesCrawled: num(r.pages_crawled),
  findings: num(r.findings),
  bySeverity: { critical: num(r.critical) ?? 0, high: num(r.high) ?? 0, medium: num(r.medium) ?? 0, low: num(r.low) ?? 0 },
  scheduled: r.scheduled === true || String(r.scheduled) === 'true',
});

/** the site's audits, oldest first (the order `previousOfType` works on), one per audit id */
async function auditsOf(site: SiteRow): Promise<AuditV1[]> {
  const rows = await siteRows<AuditRow>('audits', site.domain, { sortBy: 'audited_at:asc', max: 500 });
  const seen = new Set<string>();
  return rows.map(toAuditV1).filter((a) => a.id && !seen.has(a.id) && seen.add(a.id));
}

export async function listAudits(ctx: V1Ctx, websiteId: unknown, q: Q = {}): Promise<PageV1<AuditV1>> {
  const site = await siteOf(ctx, websiteId);
  requireVerifiedSite(site);
  const newestFirst = (await auditsOf(site)).reverse();
  return pageOf(newestFirst, decodeCursor(q.cursor), pageLimit(q.limit));
}

export async function getAudit(ctx: V1Ctx, websiteId: unknown, auditId: unknown, q: Q = {}): Promise<AuditDetailV1> {
  const site = await siteOf(ctx, websiteId);
  requireVerifiedSite(site);
  const id = str(auditId);
  if (!id || id.length > 80) throw notFound('Audit not found');
  const audits = await auditsOf(site);
  const idx = audits.findIndex((a) => a.id === id);
  if (idx < 0) throw notFound('Audit not found');
  const audit = audits[idx];
  // R66: the comparison is the previous audit of the SAME report type, never its neighbour of another type
  const prevPoint = previousOfType(audits, idx);
  const rowsOf = (aid: string) => siteRows<AuditFindingRow>('auditFindings', site.domain, { extra: [{ columnName: 'audit_id', condition: 'eq', value: aid }], max: 1000 });
  const [cur, prev] = await Promise.all([rowsOf(audit.id), prevPoint ? rowsOf(prevPoint.id) : Promise.resolve(null)]);
  const findings = findingsV1(cur, prev, (f) => oneReadingFinding(f, audit.reportType));
  return { audit, comparedWith: prevPoint?.id ?? null, findings: filterFindings(findings, { severity: q.severity, status: q.status }) };
}

// ---------------- runs ----------------

export function toRunV1(r: RunRow): RunV1 {
  const c = runCostEstimate({
    mode: r.mode as ModeId,
    input: r.input as Record<string, unknown>,
    estimatedCostUsd: r.estimatedCostUsd,
    actualCostUsd: r.actualCostUsd,
    engineCostEstimateUsd: r.engineCostEstimateUsd,
    engineCostBasis: r.engineCostBasis,
    actualCostEstimated: r.actualCostEstimated,
    actualCostPartial: r.actualCostPartial,
  });
  return {
    id: r.id,
    websiteId: r.siteId,
    mode: r.mode,
    title: r.title,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    reportCount: r.reportCount,
    cost: { usd: c.usd, basis: costBasisV1(c.source), partial: c.source === 'partial', estimated: c.estimated, note: c.basis },
  };
}

const RUN_STATUSES = ['submitting', 'accepted', 'running', 'completed', 'failed'];

export async function listRuns(ctx: V1Ctx, q: Q = {}): Promise<PageV1<RunV1>> {
  const limit = pageLimit(q.limit);
  const conds: SQL[] = [eq(schema.runs.orgId, ctx.org.id)];
  if (q.websiteId != null && q.websiteId !== '') conds.push(eq(schema.runs.siteId, (await siteOf(ctx, q.websiteId)).id));
  if (typeof q.mode === 'string' && (MODE_IDS as readonly string[]).includes(q.mode)) conds.push(eq(schema.runs.mode, q.mode));
  if (q.status === 'active') conds.push(inArray(schema.runs.status, ['submitting', 'accepted', 'running']));
  else if (typeof q.status === 'string' && RUN_STATUSES.includes(q.status)) conds.push(eq(schema.runs.status, q.status));
  const k = keyset(schema.runs.createdAt as never, schema.runs.id, decodeCursor(q.cursor));
  if (k) conds.push(k);
  const rows = await db
    .select()
    .from(schema.runs)
    .where(and(...conds))
    .orderBy(desc(ms(schema.runs.createdAt)), desc(schema.runs.id))
    .limit(limit + 1);
  return { items: rows.slice(0, limit).map(toRunV1), nextCursor: nextCursor(rows, limit, (r) => r.createdAt) };
}

export async function getRun(ctx: V1Ctx, runId: unknown): Promise<{ run: RunV1 & { input: Record<string, unknown> }; reports: ReportV1[] }> {
  if (!isUuid(runId)) throw notFound('Run not found');
  const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, ctx.org.id), eq(schema.runs.id, runId)) });
  if (!run) throw notFound('Run not found');
  const reports = await reportRows(ctx, [eq(schema.reports.runId, run.id)], 100);
  return { run: { ...toRunV1(run), input: run.input }, reports: reports.slice(0, 100).map(toReportV1Row).reverse() };
}

// ---------------- reports ----------------

/** the payload keys `deliveryDecision` reads — selected instead of whole payloads, so a page of 100 reports stays small */
const readyPayload = sql<Record<string, unknown>>`jsonb_build_object(
  'stage', ${schema.reports.payload}->'stage', 'status', ${schema.reports.payload}->'status', 'error', ${schema.reports.payload}->'error',
  'validation_error', ${schema.reports.payload}->'validation_error', 'qa_not_ready', ${schema.reports.payload}->'qa_not_ready',
  'qa_publishable', ${schema.reports.payload}->'qa_publishable', 'qa_reasons', ${schema.reports.payload}->'qa_reasons',
  'planned', ${schema.reports.payload}->'planned', 'refusal', jsonb_build_object('reason', ${schema.reports.payload}->'refusal'->'reason'),
  'verdict', ${schema.reports.payload}->'verdict', 'feasibility', jsonb_build_object('status', ${schema.reports.payload}->'feasibility'->'status'),
  'serp_features', jsonb_build_object('unavailable', ${schema.reports.payload}->'serp_features'->'unavailable'),
  'site_read_failed', ${schema.reports.payload}->'site_read_failed')`;

const reportCols = {
  id: schema.reports.id,
  runId: schema.reports.runId,
  siteId: schema.reports.siteId,
  stage: schema.reports.stage,
  status: schema.reports.status,
  title: schema.reports.title,
  summary: schema.reports.summary,
  receivedAt: schema.reports.receivedAt,
  scheduled: schema.reports.scheduled,
  ready: readyPayload,
};
type ReportListRow = { id: string; runId: string | null; siteId: string | null; stage: string; status: string; title: string; summary: Record<string, string | number | boolean | null>; receivedAt: Date; scheduled: boolean; ready: Record<string, unknown> } & { files?: ReportV1['files'] };

async function reportRows(ctx: V1Ctx, extra: SQL[], limit: number): Promise<ReportListRow[]> {
  const rows = (await db
    .select(reportCols)
    .from(schema.reports)
    .where(and(eq(schema.reports.orgId, ctx.org.id), ...extra))
    .orderBy(desc(ms(schema.reports.receivedAt)), desc(schema.reports.id))
    .limit(limit + 1)) as ReportListRow[];
  const fm = await filesFor(rows.slice(0, limit).map((r) => r.id));
  for (const r of rows) r.files = (fm.get(r.id) ?? []).map((f) => ({ id: f.id, kind: f.kind, fileName: f.fileName, mimeType: f.mimeType, size: f.size }));
  return rows;
}

function toReportV1Row(r: ReportListRow): ReportV1 {
  const d = deliveryDecision({ stage: r.stage, status: r.status, payload: r.ready ?? {} });
  return {
    id: r.id,
    runId: r.runId,
    websiteId: r.siteId,
    stage: r.stage,
    status: r.status,
    title: r.title,
    summary: r.summary,
    receivedAt: r.receivedAt.toISOString(),
    scheduled: r.scheduled,
    ready: { ok: d.deliver, code: d.code, reason: d.reason || null },
    files: r.files ?? [],
  };
}

export async function listReports(ctx: V1Ctx, q: Q = {}): Promise<PageV1<ReportV1>> {
  const limit = pageLimit(q.limit);
  const conds: SQL[] = [];
  if (q.websiteId != null && q.websiteId !== '') conds.push(eq(schema.reports.siteId, (await siteOf(ctx, q.websiteId)).id));
  if (typeof q.stage === 'string' && q.stage.trim()) conds.push(inArray(schema.reports.stage, q.stage.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10)));
  const k = keyset(schema.reports.receivedAt as never, schema.reports.id, decodeCursor(q.cursor));
  if (k) conds.push(k);
  const rows = await reportRows(ctx, conds, limit);
  return { items: rows.slice(0, limit).map(toReportV1Row), nextCursor: nextCursor(rows, limit, (r) => r.receivedAt) };
}

export async function getReport(ctx: V1Ctx, reportId: unknown): Promise<ReportV1 & { payload: Record<string, unknown> }> {
  if (!isUuid(reportId)) throw notFound('Report not found');
  const rows = await reportRows(ctx, [eq(schema.reports.id, reportId)], 1);
  const r = rows[0];
  if (!r) throw notFound('Report not found');
  const full = await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, ctx.org.id), eq(schema.reports.id, reportId)) });
  if (!full) throw notFound('Report not found');
  return { ...toReportV1Row(r), payload: full.payload };
}

export async function fileOf(ctx: V1Ctx, fileId: unknown) {
  if (!isUuid(fileId)) throw notFound('File not found');
  const f = await db.query.files.findFirst({ where: and(eq(schema.files.orgId, ctx.org.id), eq(schema.files.id, fileId)) });
  if (!f) throw notFound('File not found');
  return f;
}

// ---------------- B3-7: the publish check ----------------

/**
 * The deterministic half of the content gate, over a page the caller supplies (n8n `POST /webhook/seo-publish-check`; free, writes
 * nothing). `site`, when given (the app's own form), fills the domain, country and business facts the body leaves out. A `domain` in
 * the body must be one of THIS company's verified websites: the check is never run in another company's name.
 */
export async function publishCheck(ctx: V1Ctx, body: unknown, site: SiteRow | null = null): Promise<{ status: number; body: PublishCheckResult }> {
  requireScope(ctx, 'publish_check');
  const parsed = publishCheckSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const b: Record<string, unknown> = { ...parsed.data };
  const given = str(b.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (given) {
    const own = await db
      .select({ id: schema.sites.id, domain: schema.sites.domain })
      .from(schema.sites)
      .where(and(eq(schema.sites.orgId, ctx.org.id), sql`${schema.sites.verifiedAt} is not null`));
    if (!own.some((s) => s.domain.toLowerCase().replace(/^www\./, '') === given))
      throw new HttpError(400, 'domain must be one of your verified websites (or leave it out)', 'validation', { domain: 'Not one of your verified websites' });
    b.domain = given;
  }
  if (site) {
    if (!b.domain) b.domain = site.domain;
    if (!b.country && site.country) b.country = site.country;
    if (!b.business_facts && site.businessFacts) b.business_facts = site.businessFacts.slice(0, 5000);
  }
  const res = await publishCheckCall(b, ctx.org.id);
  if (res.kind !== 'answered' || res.status === 404 || res.status === 401 || res.status === 403 || res.status >= 500)
    throw new HttpError(502, 'The page check is not available right now, so nothing was checked. Try again in a few minutes.', 'engine_unavailable');
  if (res.status === 400) return { status: 400, body: { ok: false, publishable: false, verdict: 'error', exit_code: 2, error: str(res.json.error) || 'The engine refused the request', errors: Array.isArray(res.json.errors) ? res.json.errors.map(str) : [] } };
  if (res.status !== 200 || typeof res.json.publishable !== 'boolean')
    throw new HttpError(502, 'The page check gave no verdict, so nothing was checked. Try again in a few minutes.', 'engine_unavailable');
  return { status: 200, body: res.json as unknown as PublishCheckResult };
}
