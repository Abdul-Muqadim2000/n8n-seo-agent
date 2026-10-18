import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  CMS,
  CMS_KIND_INFO,
  cmsConnectionCreateSchema,
  cmsConnectionUpdateSchema,
  cmsPage,
  cmsPublicUrl,
  cmsPublishSchema,
  cmsReadiness,
  cmsRefreshSchema,
  fieldMapProblems,
  parseRunInput,
  roleAtLeast,
  urlOnDomain,
  type CmsBlocker,
  type CmsConnectionSettings,
  type CmsConnectionView,
  type CmsItemView,
  type CmsKind,
  type CmsMode,
  type CmsPage,
  type CmsPublishResult,
  type CmsPublishView,
  type CmsRemoteStatus,
  type CmsReportState,
  type CmsSiteState,
} from '@seo/shared';
import { requireVerified, type OrgAccess, type SiteAccess } from '../../auth/access';
import { config } from '../../config';
import { db, schema } from '../../db';
import type { CmsConnectionRow, CmsItemRow, CmsPublishRow, ReportRow, SiteRow } from '../../db/schema';
import { randomToken } from '../../lib/crypto';
import { badRequest, conflict, forbidden, HttpError, notFound, validationError } from '../../lib/errors';
import { seal, secretsReady, unseal } from '../../lib/secretBox';
import { requireClientApproval } from '../approvals';
import { createRun } from '../runs';
import { connectorFor, CmsError, type ConnCtx, type ImageWithBytes, type RemoteItem } from './connectors';
import { CmsHttpError } from './http';

/**
 * G2 — publishing written pages to the customer's CMS (app/docs/CMS_PUBLISHING.md).
 *
 * The order of a publish is the point of this file: the rule first (`cmsReadiness`, shared and unit-tested — no override), the
 * role, then the item's lease (so two clicks cannot create two posts), the CMS asked whether the item exists (adopted by slug when
 * our table lost it), a live item never silently replaced by a "draft", the push, the record, and only after a page is really live
 * the engine's "I published a page" run — which writes the content log, the ladder row and lowers the pile-up guard's count.
 */

type Log = Pick<FastifyBaseLogger, 'info' | 'warn'> | null | undefined;

// ---------------------------------------------------------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------------------------------------------------------

export function connectionView(r: CmsConnectionRow): CmsConnectionView {
  return {
    id: r.id,
    siteId: r.siteId,
    kind: r.kind as CmsKind,
    label: r.label || CMS_KIND_INFO[r.kind as CmsKind]?.label || r.kind,
    baseUrl: r.baseUrl,
    username: r.username,
    hasSecret: !!r.secret,
    settings: (r.settings ?? {}) as CmsConnectionSettings,
    status: r.status as CmsConnectionView['status'],
    statusReason: r.statusReason,
    lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function itemView(r: CmsItemRow, conn: Pick<CmsConnectionRow, 'label' | 'kind'> | undefined): CmsItemView {
  return {
    id: r.id,
    connectionId: r.connectionId,
    connectionLabel: conn ? conn.label || CMS_KIND_INFO[conn.kind as CmsKind]?.label || conn.kind : '',
    kind: (conn?.kind ?? 'webhook') as CmsKind,
    slug: r.slug,
    keyword: r.keyword,
    remoteId: r.remoteId,
    remoteUrl: r.remoteUrl,
    remoteStatus: r.remoteStatus as CmsRemoteStatus,
    lastReportId: r.lastReportId,
    engineToldAt: r.engineToldAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function publishView(r: CmsPublishRow, userName: string | null): CmsPublishView {
  return {
    id: r.id,
    reportId: r.reportId,
    connectionId: r.connectionId,
    connectionLabel: r.connectionLabel,
    kind: (r.kind || null) as CmsKind | null,
    keyword: r.keyword,
    mode: (r.mode === 'live' ? 'live' : 'draft') as CmsMode,
    status: r.status as CmsPublishView['status'],
    remoteId: r.remoteId,
    remoteUrl: r.remoteUrl,
    target: r.target,
    error: r.error,
    notes: r.notes ?? [],
    blockers: (r.blockers ?? []) as unknown as CmsBlocker[],
    engineRunId: r.engineRunId,
    userName,
    createdAt: r.createdAt.toISOString(),
  };
}

const label = (c: Pick<CmsConnectionRow, 'label' | 'kind'>) => c.label || CMS_KIND_INFO[c.kind as CmsKind]?.label || c.kind;
const hostOf = (c: Pick<CmsConnectionRow, 'kind' | 'baseUrl'>) =>
  c.kind === 'webflow' ? 'api.webflow.com' : c.kind === 'contentful' ? 'api.contentful.com' : (c.baseUrl.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? c.kind);

/** Hook for a company audit log when one exists; today the publish log is the audit trail and this writes to the server log. */
function audit(log: Log, event: string, data: Record<string, unknown>) {
  log?.info({ cms: event, ...data }, `cms ${event}`);
}

// ---------------------------------------------------------------------------------------------------------------------------
// connections
// ---------------------------------------------------------------------------------------------------------------------------

async function connectionOf(orgId: string, siteId: string, id: unknown): Promise<CmsConnectionRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Connection not found');
  const c = await db.query.cmsConnections.findFirst({ where: and(eq(schema.cmsConnections.id, id), eq(schema.cmsConnections.orgId, orgId), eq(schema.cmsConnections.siteId, siteId)) });
  if (!c) throw notFound('Connection not found');
  return c;
}

export async function listConnections(orgId: string, siteId: string): Promise<CmsConnectionView[]> {
  const rows = await db
    .select()
    .from(schema.cmsConnections)
    .where(and(eq(schema.cmsConnections.orgId, orgId), eq(schema.cmsConnections.siteId, siteId)))
    .orderBy(schema.cmsConnections.createdAt);
  return rows.map(connectionView);
}

const needKey = () => {
  if (!secretsReady())
    throw badRequest('This server cannot store CMS credentials yet (MAILBOX_KEY is not set). Ask the platform administrator to set it.', undefined, 'secrets_unavailable');
};

export async function createConnection(a: SiteAccess, body: unknown, log?: Log): Promise<{ connection: CmsConnectionView; signingSecret?: string }> {
  requireVerified(a.site);
  const parsed = cmsConnectionCreateSchema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  const v = parsed.data;
  needKey();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.cmsConnections).where(eq(schema.cmsConnections.siteId, a.site.id));
  if (n >= CMS.maxConnectionsPerSite) throw badRequest(`A website can have at most ${CMS.maxConnectionsPerSite} CMS connections.`);

  let secret: string;
  let signingSecret: string | undefined;
  const settings: CmsConnectionSettings = { publicUrlTemplate: v.publicUrlTemplate };
  let baseUrl = '';
  let username = '';
  switch (v.kind) {
    case 'wordpress':
      secret = v.secret;
      baseUrl = v.baseUrl;
      username = v.username;
      Object.assign(settings, { postType: v.postType, categories: v.categories, tags: v.tags });
      break;
    case 'webflow':
      secret = v.secret;
      Object.assign(settings, { collectionId: v.collectionId, fieldMap: v.fieldMap });
      break;
    case 'contentful':
      secret = v.secret;
      Object.assign(settings, { spaceId: v.spaceId, environment: v.environment, contentTypeId: v.contentTypeId, fieldMap: v.fieldMap });
      break;
    case 'webhook':
      // the app makes the signing secret, so it is long and random; it is shown exactly once
      signingSecret = 'whsec_' + randomToken(32);
      secret = signingSecret;
      baseUrl = v.baseUrl;
      break;
  }
  const [row] = await db
    .insert(schema.cmsConnections)
    .values({ orgId: a.org.id, siteId: a.site.id, kind: v.kind, label: v.label, baseUrl, username, secret: seal(secret), settings: settings as Record<string, unknown>, createdBy: a.user.id })
    .returning();
  audit(log, 'connection.create', { orgId: a.org.id, siteId: a.site.id, connectionId: row.id, kind: v.kind, by: a.user.id });
  return { connection: connectionView(row), ...(signingSecret ? { signingSecret } : {}) };
}

export async function updateConnection(a: SiteAccess, id: unknown, body: unknown, log?: Log): Promise<CmsConnectionView> {
  const c = await connectionOf(a.org.id, a.site.id, id);
  const parsed = cmsConnectionUpdateSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const v = parsed.data;
  const settings = { ...(c.settings as CmsConnectionSettings) };
  const patch: Partial<CmsConnectionRow> = { updatedAt: new Date() };
  let retest = false;
  if (v.label !== undefined) patch.label = v.label;
  if (v.publicUrlTemplate !== undefined) settings.publicUrlTemplate = v.publicUrlTemplate;
  if (c.kind === 'wordpress' || c.kind === 'webhook') {
    if (v.baseUrl !== undefined && v.baseUrl !== c.baseUrl) (patch.baseUrl = v.baseUrl), (retest = true);
  }
  if (c.kind === 'wordpress') {
    if (v.username !== undefined && v.username !== c.username) (patch.username = v.username), (retest = true);
    if (v.postType !== undefined && v.postType !== settings.postType) (settings.postType = v.postType), (retest = true);
    if (v.categories !== undefined) settings.categories = v.categories;
    if (v.tags !== undefined) settings.tags = v.tags;
  }
  if (c.kind === 'webflow' && v.collectionId !== undefined && v.collectionId !== settings.collectionId) {
    settings.collectionId = v.collectionId;
    settings.remoteFields = [];
    settings.fieldMap = {};
    retest = true;
  }
  if (c.kind === 'contentful') {
    for (const k of ['spaceId', 'environment', 'contentTypeId'] as const)
      if (v[k] !== undefined && v[k] !== settings[k]) {
        settings[k] = v[k];
        settings.remoteFields = [];
        settings.fieldMap = {};
        retest = true;
      }
  }
  if ((c.kind === 'webflow' || c.kind === 'contentful') && v.fieldMap !== undefined) {
    const problems = fieldMapProblems(c.kind, v.fieldMap, settings.remoteFields ?? []);
    if (problems.length) throw new HttpError(400, problems[0]!, 'validation', { fieldMap: problems.join(' · ') });
    settings.fieldMap = v.fieldMap;
  }
  if (v.secret !== undefined && c.kind !== 'webhook') {
    needKey();
    patch.secret = seal(c.kind === 'wordpress' ? v.secret.replace(/\s+/g, ' ') : v.secret);
    retest = true;
  }
  if (retest) (patch.status = 'untested'), (patch.statusReason = '');
  patch.settings = settings as Record<string, unknown>;
  const [row] = await db.update(schema.cmsConnections).set(patch).where(eq(schema.cmsConnections.id, c.id)).returning();
  audit(log, 'connection.update', { orgId: a.org.id, siteId: a.site.id, connectionId: c.id, fields: Object.keys(v), by: a.user.id });
  return connectionView(row);
}

export async function deleteConnection(a: SiteAccess, id: unknown, log?: Log): Promise<{ ok: true }> {
  const c = await connectionOf(a.org.id, a.site.id, id);
  await db.delete(schema.cmsConnections).where(eq(schema.cmsConnections.id, c.id));
  audit(log, 'connection.delete', { orgId: a.org.id, siteId: a.site.id, connectionId: c.id, by: a.user.id });
  return { ok: true };
}

function ctxOf(c: CmsConnectionRow): ConnCtx {
  let secret = '';
  try {
    secret = c.secret ? unseal(c.secret) : '';
  } catch {
    throw badRequest('The stored credentials of this connection cannot be read (the server key changed). Paste the secret again.', undefined, 'secret_unreadable');
  }
  return { baseUrl: c.baseUrl, username: c.username, secret, settings: (c.settings ?? {}) as CmsConnectionSettings };
}

const errText = (e: unknown): string => (e instanceof CmsError || e instanceof CmsHttpError ? e.message : 'The CMS could not be reached.');

export async function testConnection(a: SiteAccess, id: unknown, log?: Log): Promise<{ ok: boolean; message: string; connection: CmsConnectionView }> {
  const c = await connectionOf(a.org.id, a.site.id, id);
  const connector = connectorFor(c.kind);
  if (!connector) throw badRequest('Unknown CMS');
  let ok = false;
  let message = '';
  let learned: Partial<CmsConnectionSettings> = {};
  try {
    const r = await connector.test(ctxOf(c));
    ok = r.ok;
    message = r.message;
    learned = r.settings ?? {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    message = errText(e);
    log?.warn({ connectionId: c.id, err: errText(e) }, 'cms test failed');
  }
  const settings = { ...(c.settings as CmsConnectionSettings), ...learned };
  // a mapping that no longer fits the fields just read is reported, not silently kept
  if (ok && (c.kind === 'webflow' || c.kind === 'contentful')) {
    const problems = fieldMapProblems(c.kind, settings.fieldMap ?? {}, settings.remoteFields ?? []);
    if (problems.length && Object.keys(settings.fieldMap ?? {}).length) message += ` Mapping to finish: ${problems.join('; ')}.`;
  }
  const [row] = await db
    .update(schema.cmsConnections)
    .set({ status: ok ? 'ok' : 'error', statusReason: ok ? '' : message.slice(0, 500), lastTestedAt: new Date(), settings: settings as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(schema.cmsConnections.id, c.id))
    .returning();
  audit(log, 'connection.test', { orgId: a.org.id, connectionId: c.id, ok, by: a.user.id });
  return { ok, message, connection: connectionView(row) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------------------------------------------------------

async function reportOf(orgId: string, reportId: unknown): Promise<{ report: ReportRow; site: SiteRow | null }> {
  if (typeof reportId !== 'string' || !/^[0-9a-f-]{36}$/i.test(reportId)) throw notFound('Report not found');
  const report = await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.id, reportId)) });
  if (!report) throw notFound('Report not found');
  const site = report.siteId ? ((await db.query.sites.findFirst({ where: and(eq(schema.sites.id, report.siteId), eq(schema.sites.orgId, orgId)) })) ?? null) : null;
  return { report, site };
}

const readinessOf = (report: ReportRow, site: SiteRow | null, page: CmsPage) =>
  cmsReadiness({ stage: report.stage, status: report.status, payload: (report.payload ?? {}) as Record<string, unknown>, siteDomain: site?.domain ?? null }, page);

async function historyFor(orgId: string, where: ReturnType<typeof and>, limit = 30): Promise<CmsPublishView[]> {
  const rows = await db
    .select({ p: schema.cmsPublishes, userName: schema.users.name })
    .from(schema.cmsPublishes)
    .leftJoin(schema.users, eq(schema.cmsPublishes.userId, schema.users.id))
    .where(and(eq(schema.cmsPublishes.orgId, orgId), where))
    .orderBy(desc(schema.cmsPublishes.createdAt))
    .limit(limit);
  return rows.map((r) => publishView(r.p, r.userName));
}

export async function reportState(a: OrgAccess, reportId: unknown): Promise<CmsReportState> {
  const { report, site } = await reportOf(a.org.id, reportId);
  const page = cmsPage((report.payload ?? {}) as Record<string, unknown>);
  const readiness = readinessOf(report, site, page);
  const conns = site ? await db.select().from(schema.cmsConnections).where(and(eq(schema.cmsConnections.orgId, a.org.id), eq(schema.cmsConnections.siteId, site.id))) : [];
  const items =
    site && page.slug && conns.length
      ? await db
          .select()
          .from(schema.cmsItems)
          .where(and(eq(schema.cmsItems.orgId, a.org.id), eq(schema.cmsItems.slug, page.slug), inArray(schema.cmsItems.connectionId, conns.map((c) => c.id))))
      : [];
  const byId = new Map(conns.map((c) => [c.id, c]));
  const history = await historyFor(a.org.id, items.length ? or(eq(schema.cmsPublishes.reportId, report.id), inArray(schema.cmsPublishes.itemId, items.map((i) => i.id))) : eq(schema.cmsPublishes.reportId, report.id));
  const isPage = !readiness.blockers.some((b) => b.code === 'not_a_page');
  return {
    readiness,
    canDraft: roleAtLeast(a.role, 'member') && readiness.draftAllowed && conns.length > 0 && !!site?.verifiedAt,
    canLive: roleAtLeast(a.role, 'admin') && readiness.liveAllowed && conns.length > 0 && !!site?.verifiedAt,
    page: isPage ? { title: page.title, slug: page.slug, keyword: page.keyword, images: page.images.length } : null,
    connections: conns.map(connectionView),
    // an item row that never reached the CMS (a failed first send) is not "in the CMS"
    items: items.filter((i) => i.remoteId).map((i) => itemView(i, byId.get(i.connectionId))),
    history,
    publicUrls: Object.fromEntries(conns.map((c) => [c.id, cmsPublicUrl((c.settings as CmsConnectionSettings).publicUrlTemplate, page, site?.domain ?? '')])),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// publishing
// ---------------------------------------------------------------------------------------------------------------------------

async function record(v: typeof schema.cmsPublishes.$inferInsert): Promise<CmsPublishRow> {
  const [row] = await db.insert(schema.cmsPublishes).values(v).returning();
  return row;
}

/** Takes the item for one publish (2 minutes); null when another publish holds it. */
async function lease(itemId: string): Promise<CmsItemRow | null> {
  const [row] = await db
    .update(schema.cmsItems)
    .set({ lockUntil: sql`now() + make_interval(mins => ${CMS.leaseMinutes})` })
    .where(and(eq(schema.cmsItems.id, itemId), or(isNull(schema.cmsItems.lockUntil), lt(schema.cmsItems.lockUntil, sql`now()`))))
    .returning();
  return row ?? null;
}

async function imagesWithBytes(orgId: string, page: CmsPage): Promise<ImageWithBytes[]> {
  const ids = page.images.map((i) => i.fileId).filter((x): x is string => !!x);
  const files = ids.length ? await db.select().from(schema.files).where(and(eq(schema.files.orgId, orgId), inArray(schema.files.id, ids))) : [];
  const byId = new Map(files.map((f) => [f.id, f]));
  return page.images.map((im) => {
    const f = im.fileId ? byId.get(im.fileId) : undefined;
    // only real images, and never more than 10 MB each
    const ok = f && /^image\/(webp|png|jpe?g|gif|avif)$/i.test(f.mimeType || im.mimeType) && f.size <= 10 * 1024 * 1024;
    return { ...im, mimeType: f?.mimeType || im.mimeType, data: ok ? f!.data : null };
  });
}

/**
 * After a page is live: the engine's "I published a page" run (mode `published`, free). It reads the live page, marks the content
 * log row and the ladder row published, and the pile-up guard counts one page fewer. The address must be on the website's domain —
 * the engine refuses any other — so a CMS address elsewhere (a Webflow staging domain, a headless CMS without a pattern) is said.
 */
async function tellEngine(a: OrgAccess, site: SiteRow, page: CmsPage, url: string, log?: Log): Promise<{ told: boolean; runId: string | null; note: string }> {
  if (!url || !urlOnDomain(url, site.domain))
    return { told: false, runId: null, note: `The engine was not told: the page's address${url ? ` (${url})` : ''} is not on ${site.domain}. Set the address pattern of this connection, or use "I published a page" with the live address.` };
  const keyword = (page.keyword || page.title).slice(0, 120);
  const input = parseRunInput({ mode: 'published', siteId: site.id, keyword, publishedUrl: url, emailCopy: false });
  if (!input.success) return { told: false, runId: null, note: 'The engine was not told: the page address could not be used. Use "I published a page".' };
  try {
    const run = await createRun(a, input.data);
    if (run.status === 'failed') return { told: false, runId: run.id, note: `The engine could not be told right now (${run.error ?? 'the engine did not answer'}). "Check if it is live" tries again.` };
    return { told: true, runId: run.id, note: `The engine is checking ${url} now: it marks the page published, starts tracking it and the weekly posts continue.` };
  } catch (e) {
    log?.warn({ err: String((e as Error).message) }, 'cms: engine not told');
    return { told: false, runId: null, note: `The engine could not be told (${(e as Error).message}). "Check if it is live" tries again.` };
  }
}

export async function publishReport(a: OrgAccess, reportId: unknown, body: unknown, log?: Log): Promise<CmsPublishResult> {
  const parsed = cmsPublishSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const { connectionId, mode, confirmLive } = parsed.data;
  if (mode === 'live' && !roleAtLeast(a.role, 'admin')) throw forbidden('Only an owner or admin can publish a page live. Send it as a draft for them to publish.');
  if (mode === 'live' && !confirmLive) throw badRequest('Publishing live is an explicit choice: tick the confirmation first.', { confirmLive: 'Required to publish live' }, 'confirm_live');

  const { report, site } = await reportOf(a.org.id, reportId);
  if (!site) throw badRequest('This page was written without one of your websites, so it has no CMS connection.');
  requireVerified(site);
  // G5: a client workspace that approves pages first: no live publish without the client's approval of this page
  if (mode === 'live') await requireClientApproval(a.org, 'page', report.id);
  const conn = await connectionOf(a.org.id, site.id, connectionId);
  const connector = connectorFor(conn.kind);
  if (!connector) throw badRequest('Unknown CMS');
  const page = cmsPage((report.payload ?? {}) as Record<string, unknown>);
  const readiness = readinessOf(report, site, page);
  const base = { orgId: a.org.id, siteId: site.id, connectionId: conn.id, reportId: report.id, userId: a.user.id, kind: conn.kind, connectionLabel: label(conn), keyword: page.keyword, mode, target: hostOf(conn) };
  const settings = (conn.settings ?? {}) as CmsConnectionSettings;

  // 1. the rule, which has no override
  let blockers: CmsBlocker[] = readiness.blockers;
  if (!blockers.length && mode === 'live' && !readiness.liveAllowed) blockers = [{ code: 'not_ready', message: readiness.liveRefusal }];
  if (!blockers.length && (conn.kind === 'webflow' || conn.kind === 'contentful')) {
    const problems = fieldMapProblems(conn.kind, settings.fieldMap ?? {}, settings.remoteFields ?? []);
    if (!settings.remoteFields?.length) problems.unshift('Test the connection first: the fields of your CMS have not been read yet');
    if (problems.length) blockers = [{ code: 'not_ready', message: `Finish the field mapping in Website settings → Publishing: ${problems.join('; ')}.` }];
  }
  if (blockers.length) {
    const row = await record({ ...base, status: 'blocked', blockers: blockers as unknown as Record<string, unknown>[], error: blockers[0]!.message });
    audit(log, 'publish.blocked', { orgId: a.org.id, reportId: report.id, connectionId: conn.id, mode, codes: blockers.map((b) => b.code) });
    return { ok: false, record: publishView(row, a.user.name), item: null, engine: { told: false, runId: null, note: '' } };
  }

  // 2. the item, and its lease
  await db
    .insert(schema.cmsItems)
    .values({ orgId: a.org.id, siteId: site.id, connectionId: conn.id, slug: page.slug, keyword: page.keyword, lastReportId: report.id })
    .onConflictDoNothing({ target: [schema.cmsItems.connectionId, schema.cmsItems.slug] });
  const existing = await db.query.cmsItems.findFirst({ where: and(eq(schema.cmsItems.connectionId, conn.id), eq(schema.cmsItems.slug, page.slug)) });
  if (!existing || existing.orgId !== a.org.id) throw notFound('Connection not found');
  const item = await lease(existing.id);
  if (!item) throw conflict('This page is being sent to the CMS right now. Wait a moment and look again.', 'cms_busy');

  const publicUrl = cmsPublicUrl(settings.publicUrlTemplate, page, site.domain);
  const notes: string[] = [];
  try {
    const ctx = ctxOf(conn);
    // 3. what the CMS already has: our item, or one carrying the same slug (adopted, so a lost write cannot make a duplicate)
    let remote: RemoteItem | null = null;
    if (item.remoteId) {
      remote = await connector.status(ctx, item.remoteId);
      if (!remote && conn.kind !== 'webhook') notes.push('The earlier item was not found in the CMS any more, so a new one was made.');
      if (!remote && conn.kind === 'webhook') remote = { id: item.remoteId, url: item.remoteUrl, status: item.remoteStatus as CmsRemoteStatus };
    }
    if (!remote) {
      remote = await connector.find(ctx, page);
      if (remote) notes.push(`An item with the slug "${page.slug}" was already in the CMS: it was updated, not duplicated.`);
    }
    // 4. a live page is never replaced by a "draft" (in WordPress an update of a live post is live at once)
    if (remote?.status === 'published' && mode === 'draft') {
      const message = `This page is already live in ${label(conn)}: sending it again changes the live page, so it needs "Publish live" (owners and admins).`;
      const row = await record({ ...base, status: 'blocked', remoteId: remote.id, remoteUrl: remote.url, error: message, blockers: [{ code: 'not_ready', message }] });
      await db.update(schema.cmsItems).set({ lockUntil: null, remoteId: remote.id, remoteStatus: 'published', updatedAt: new Date() }).where(eq(schema.cmsItems.id, item.id));
      return { ok: false, record: publishView(row, a.user.name), item: null, engine: { told: false, runId: null, note: '' } };
    }

    const result = await connector.push(ctx, page, {
      mode,
      remote,
      idempotencyKey: item.id,
      images: await imagesWithBytes(a.org.id, page),
      media: item.media ?? {},
      publicUrl,
      domain: site.domain,
      report: { id: report.id, url: `${config.appUrl}/o/${a.org.id}/reports/${report.id}` },
      sentBy: a.user.name,
    });
    notes.push(...result.notes);
    const [saved] = await db
      .update(schema.cmsItems)
      .set({ remoteId: result.id, remoteUrl: result.url, remoteStatus: result.status, keyword: page.keyword, lastReportId: report.id, media: result.media ?? item.media ?? {}, lockUntil: null, updatedAt: new Date() })
      .where(eq(schema.cmsItems.id, item.id))
      .returning();

    // 5. live: tell the engine
    let engine: CmsPublishResult['engine'] = { told: false, runId: null, note: '' };
    if (result.status === 'published') {
      const liveUrl = result.url && urlOnDomain(result.url, site.domain) ? result.url : publicUrl;
      engine = await tellEngine(a, site, page, liveUrl, log);
      if (engine.told) await db.update(schema.cmsItems).set({ engineToldAt: new Date() }).where(eq(schema.cmsItems.id, item.id));
      if (engine.note) notes.push(engine.note);
    }
    const row = await record({ ...base, itemId: item.id, status: 'sent', remoteId: result.id, remoteUrl: result.url, notes, engineRunId: engine.runId });
    audit(log, 'publish.sent', { orgId: a.org.id, reportId: report.id, connectionId: conn.id, mode, remoteId: result.id, by: a.user.id });
    const fresh = engine.told ? { ...saved, engineToldAt: new Date() } : saved;
    return { ok: true, record: publishView(row, a.user.name), item: itemView(fresh, conn), engine };
  } catch (e) {
    await db.update(schema.cmsItems).set({ lockUntil: null }).where(eq(schema.cmsItems.id, item.id));
    if (e instanceof HttpError) throw e;
    const message = errText(e);
    if (!(e instanceof CmsError) && !(e instanceof CmsHttpError)) log?.warn({ err: String((e as Error)?.message ?? e), connectionId: conn.id }, 'cms publish failed');
    const row = await record({ ...base, itemId: item.id, status: 'failed', error: message, notes });
    audit(log, 'publish.failed', { orgId: a.org.id, reportId: report.id, connectionId: conn.id, mode });
    return { ok: false, record: publishView(row, a.user.name), item: itemView(item, conn), engine: { told: false, runId: null, note: '' } };
  }
}

/** "Check if it is live": asks the CMS; a page that went live there (or here, untold) is reported to the engine now. */
export async function refreshReport(a: OrgAccess, reportId: unknown, body: unknown, log?: Log): Promise<CmsPublishResult> {
  const parsed = cmsRefreshSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const { report, site } = await reportOf(a.org.id, reportId);
  if (!site) throw badRequest('This page was written without one of your websites.');
  requireVerified(site);
  const conn = await connectionOf(a.org.id, site.id, parsed.data.connectionId);
  const connector = connectorFor(conn.kind)!;
  const page = cmsPage((report.payload ?? {}) as Record<string, unknown>);
  const item = await db.query.cmsItems.findFirst({ where: and(eq(schema.cmsItems.connectionId, conn.id), eq(schema.cmsItems.slug, page.slug), eq(schema.cmsItems.orgId, a.org.id)) });
  if (!item || !item.remoteId) throw notFound('This page has not been sent to this CMS yet.');
  const base = { orgId: a.org.id, siteId: site.id, connectionId: conn.id, reportId: report.id, itemId: item.id, userId: a.user.id, kind: conn.kind, connectionLabel: label(conn), keyword: page.keyword, mode: 'refresh', target: hostOf(conn) };
  const settings = (conn.settings ?? {}) as CmsConnectionSettings;
  try {
    const remote = conn.kind === 'webhook' ? { id: item.remoteId, url: item.remoteUrl, status: item.remoteStatus as CmsRemoteStatus } : await connector.status(ctxOf(conn), item.remoteId);
    if (!remote) {
      const row = await record({ ...base, status: 'failed', error: `The item is no longer in ${label(conn)}. Send the page again to make a new one.` });
      await db.update(schema.cmsItems).set({ remoteStatus: 'unknown', updatedAt: new Date() }).where(eq(schema.cmsItems.id, item.id));
      return { ok: false, record: publishView(row, a.user.name), item: itemView({ ...item, remoteStatus: 'unknown' }, conn), engine: { told: false, runId: null, note: '' } };
    }
    const notes: string[] = [remote.status === 'published' ? `Live in ${label(conn)}.` : `Still a draft in ${label(conn)}.`];
    let engine: CmsPublishResult['engine'] = { told: false, runId: null, note: '' };
    if (remote.status === 'published' && !item.engineToldAt) {
      const url = remote.url && urlOnDomain(remote.url, site.domain) ? remote.url : cmsPublicUrl(settings.publicUrlTemplate, page, site.domain);
      engine = await tellEngine(a, site, page, url, log);
      if (engine.note) notes.push(engine.note);
    }
    const [saved] = await db
      .update(schema.cmsItems)
      .set({ remoteStatus: remote.status, remoteUrl: remote.url || item.remoteUrl, updatedAt: new Date(), ...(engine.told ? { engineToldAt: new Date() } : {}) })
      .where(eq(schema.cmsItems.id, item.id))
      .returning();
    const row = await record({ ...base, status: 'sent', remoteId: remote.id, remoteUrl: remote.url || item.remoteUrl, notes, engineRunId: engine.runId });
    return { ok: true, record: publishView(row, a.user.name), item: itemView(saved, conn), engine };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const row = await record({ ...base, status: 'failed', error: errText(e) });
    return { ok: false, record: publishView(row, a.user.name), item: itemView(item, conn), engine: { told: false, runId: null, note: '' } };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// the website's picture (Content page, Pipeline)
// ---------------------------------------------------------------------------------------------------------------------------

export async function siteState(orgId: string, siteId: string): Promise<CmsSiteState> {
  const conns = await db.select().from(schema.cmsConnections).where(and(eq(schema.cmsConnections.orgId, orgId), eq(schema.cmsConnections.siteId, siteId)));
  const byId = new Map(conns.map((c) => [c.id, c]));
  const items = await db
    .select()
    .from(schema.cmsItems)
    .where(and(eq(schema.cmsItems.orgId, orgId), eq(schema.cmsItems.siteId, siteId)))
    .orderBy(desc(schema.cmsItems.updatedAt))
    .limit(300);
  const recent = await historyFor(orgId, eq(schema.cmsPublishes.siteId, siteId), 50);
  return { connections: conns.map(connectionView), items: items.filter((i) => i.remoteId).map((i) => itemView(i, byId.get(i.connectionId))), recent };
}

const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The Pipeline's "publish" items say what the CMS already holds and, when the website has a connection, offer to send the page from
 * its report. Read-only; a failure leaves the items as they were.
 */
export async function annotatePublishNeeds(orgId: string, siteId: string, items: { kind: string; detail: string; action: { label: string; prefill?: Record<string, unknown>; reportId?: string; mode?: string } | null }[]): Promise<void> {
  const publish = items.filter((i) => i.kind === 'publish');
  if (!publish.length) return;
  const state = await siteState(orgId, siteId);
  const drafts = new Map(state.items.map((i) => [norm(i.keyword), i]));
  for (const it of publish) {
    const keyword = typeof it.action?.prefill?.keyword === 'string' ? (it.action.prefill.keyword as string) : '';
    const held = keyword ? drafts.get(norm(keyword)) : undefined;
    if (held) it.detail += ` A ${held.remoteStatus === 'published' ? 'live page' : 'draft'} of “${keyword}” is in ${held.connectionLabel}.`;
    if (!state.connections.length || !keyword || held?.remoteStatus === 'published') continue;
    const [r] = await db
      .select({ id: schema.reports.id })
      .from(schema.reports)
      .where(and(eq(schema.reports.orgId, orgId), eq(schema.reports.siteId, siteId), eq(schema.reports.stage, 'content'), sql`lower(${schema.reports.payload}->>'keyword') = ${norm(keyword)}`))
      .orderBy(desc(schema.reports.receivedAt))
      .limit(1);
    if (r && it.action) it.action = { label: held ? `Publish from ${held.connectionLabel}` : 'Send to your CMS', reportId: r.id };
  }
}
