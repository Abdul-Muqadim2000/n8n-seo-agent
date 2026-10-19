import { and, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { isClientRole, outreachItemId, roleAtLeast, type ApprovalCandidate, type ApprovalView, type Role } from '@seo/shared';
import { linkBuildingData } from './linkBuilder';
import type { OrgAccess } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, PortalApprovalRow } from '../db/schema';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/errors';
import { audit } from './audit';

/**
 * G5 (WHITE_LABEL.md §2, §4): the agency asks the client to approve an item, a written page (its report) or one outreach draft
 * (prospect and type), and a client approver decides. A decision is a record; with "client approval required" on the workspace, a
 * live CMS publish of that page and an outreach approval of that draft are refused until an approved decision exists.
 */

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function names(ids: (string | null)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter(Boolean) as string[])];
  if (!list.length) return new Map();
  return new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, list))).map((u) => [u.id, u.name]));
}

async function view(rows: PortalApprovalRow[]): Promise<ApprovalView[]> {
  const who = await names(rows.flatMap((r) => [r.requestedBy, r.decidedBy]));
  const siteIds = [...new Set(rows.map((r) => r.siteId).filter(Boolean) as string[])];
  const domains = new Map(siteIds.length ? (await db.select({ id: schema.sites.id, domain: schema.sites.domain }).from(schema.sites).where(inArray(schema.sites.id, siteIds))).map((s) => [s.id, s.domain]) : []);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ApprovalView['kind'],
    itemId: r.itemId,
    siteId: r.siteId,
    siteDomain: r.siteId ? (domains.get(r.siteId) ?? null) : null,
    title: r.title,
    status: r.status as ApprovalView['status'],
    note: r.note,
    requestedBy: r.requestedBy ? (who.get(r.requestedBy) ?? null) : null,
    requestedAt: r.requestedAt.toISOString(),
    decisionNote: r.decisionNote,
    decidedBy: r.decidedBy ? (who.get(r.decidedBy) ?? null) : null,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    reportId: r.kind === 'page' && uuidRe.test(r.itemId) ? r.itemId : null,
  }));
}

export async function listApprovals(orgId: string, opts: { status?: string } = {}): Promise<ApprovalView[]> {
  const where = opts.status ? and(eq(schema.portalApprovals.orgId, orgId), eq(schema.portalApprovals.status, opts.status)) : and(eq(schema.portalApprovals.orgId, orgId), ne(schema.portalApprovals.status, 'withdrawn'));
  return view(await db.select().from(schema.portalApprovals).where(where).orderBy(desc(schema.portalApprovals.requestedAt)).limit(200));
}

/** what the agency can ask about: recent written pages of the workspace and outreach drafts not sent yet */
export async function approvalCandidates(org: OrgRow): Promise<ApprovalCandidate[]> {
  const since = new Date(Date.now() - 60 * 864e5);
  const pages = await db
    .select({ id: schema.reports.id, title: schema.reports.title, siteId: schema.reports.siteId, at: schema.reports.receivedAt, summary: schema.reports.summary, domain: schema.sites.domain })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .where(and(eq(schema.reports.orgId, org.id), eq(schema.reports.stage, 'content'), gte(schema.reports.receivedAt, since)))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(50);
  const out: ApprovalCandidate[] = pages
    .filter((p) => p.summary.hasPage === true)
    .map((p) => ({ kind: 'page' as const, itemId: p.id, siteId: p.siteId, siteDomain: p.domain ?? null, title: p.title, at: p.at.toISOString() }));
  // outreach drafts live in the engine: read them per verified website (a few), and say nothing when the engine cannot be read
  const sites = (await db.query.sites.findMany({ where: eq(schema.sites.orgId, org.id) })).filter((s) => s.verifiedAt).slice(0, 5);
  for (const site of sites) {
    try {
      const data = await linkBuildingData(org, site, 'admin');
      for (const d of data.drafts.slice(0, 20))
        out.push({
          kind: 'outreach',
          itemId: outreachItemId(d.prospectDomain, d.type),
          siteId: site.id,
          siteDomain: site.domain,
          title: `Outreach to ${d.prospectDomain}${d.steps[0]?.subject ? `: ${d.steps[0].subject}` : ''}`.slice(0, 200),
          at: d.draftedAt || new Date().toISOString(),
        });
    } catch {
      /* the engine is not reachable: pages only */
    }
  }
  return out;
}

export async function requestApproval(req: FastifyRequest, a: OrgAccess, body: { kind: 'page' | 'outreach'; itemId: string; siteId: string | null; title: string; note: string }): Promise<ApprovalView> {
  if (a.org.kind !== 'client') throw badRequest('Approvals exist in client workspaces.');
  if (isClientRole(a.role) || !roleAtLeast(a.role, 'member')) throw forbidden('Only the agency asks for approvals.');
  let siteId = body.siteId;
  if (body.kind === 'page') {
    if (!uuidRe.test(body.itemId)) throw notFound('Report not found');
    const r = await db.query.reports.findFirst({ where: and(eq(schema.reports.id, body.itemId), eq(schema.reports.orgId, a.org.id)) });
    if (!r) throw notFound('Report not found');
    siteId = r.siteId;
  } else {
    if (!/^[a-z0-9.-]+\|[a-z_]+$/.test(body.itemId)) throw badRequest('Choose an outreach draft.');
    if (!siteId) throw badRequest('Choose the website of the draft.');
  }
  if (siteId) {
    const s = await db.query.sites.findFirst({ where: and(eq(schema.sites.id, siteId), eq(schema.sites.orgId, a.org.id)) });
    if (!s) throw notFound('Website not found');
  }
  // asking again replaces the open request for that item: the client decides on what is there now
  await db
    .update(schema.portalApprovals)
    .set({ status: 'withdrawn' })
    .where(and(eq(schema.portalApprovals.orgId, a.org.id), eq(schema.portalApprovals.kind, body.kind), eq(schema.portalApprovals.itemId, body.itemId), inArray(schema.portalApprovals.status, ['pending', 'approved', 'changes_requested'])));
  const [row] = await db
    .insert(schema.portalApprovals)
    .values({ orgId: a.org.id, siteId, kind: body.kind, itemId: body.itemId, title: body.title, note: body.note, requestedBy: a.user.id })
    .returning();
  await audit(req, a.org.id, { action: 'approval.requested', target: { type: 'approval', id: row.id, label: body.title }, details: { kind: body.kind } });
  return (await view([row]))[0]!;
}

async function own(orgId: string, id: string): Promise<PortalApprovalRow> {
  if (!uuidRe.test(id)) throw notFound('Approval not found');
  const r = await db.query.portalApprovals.findFirst({ where: and(eq(schema.portalApprovals.id, id), eq(schema.portalApprovals.orgId, orgId)) });
  if (!r) throw notFound('Approval not found');
  return r;
}

export async function decideApproval(req: FastifyRequest, a: OrgAccess, id: string, body: { decision: 'approved' | 'changes_requested'; note: string }): Promise<ApprovalView> {
  if (a.role !== 'client_approver') throw forbidden('Only the client\'s approvers decide.');
  const r = await own(a.org.id, id);
  if (r.status !== 'pending') throw conflict('This was already decided or withdrawn.');
  if (body.decision === 'changes_requested' && !body.note.trim()) throw badRequest('Say what should change.', { note: 'Say what should change' });
  const [u] = await db
    .update(schema.portalApprovals)
    .set({ status: body.decision, decisionNote: body.note || null, decidedBy: a.user.id, decidedAt: new Date() })
    .where(and(eq(schema.portalApprovals.id, r.id), eq(schema.portalApprovals.status, 'pending')))
    .returning();
  if (!u) throw conflict('This was already decided or withdrawn.');
  await audit(req, a.org.id, { action: body.decision === 'approved' ? 'approval.approved' : 'approval.changes_requested', target: { type: 'approval', id: r.id, label: r.title }, details: { kind: r.kind } });
  return (await view([u]))[0]!;
}

export async function withdrawApproval(req: FastifyRequest, a: OrgAccess, id: string): Promise<void> {
  if (isClientRole(a.role) || !roleAtLeast(a.role, 'member')) throw forbidden('Only the agency withdraws a request.');
  const r = await own(a.org.id, id);
  if (r.status === 'withdrawn') return;
  await db.update(schema.portalApprovals).set({ status: 'withdrawn' }).where(eq(schema.portalApprovals.id, r.id));
  await audit(req, a.org.id, { action: 'approval.withdrawn', target: { type: 'approval', id: r.id, label: r.title }, details: { kind: r.kind } });
}

/** the guard: with client approval required, the item must have an approved decision (the latest request for it) */
export async function requireClientApproval(org: Pick<OrgRow, 'id' | 'kind' | 'clientApproval'>, kind: 'page' | 'outreach', itemId: string, role?: Role): Promise<void> {
  if (org.kind !== 'client' || !org.clientApproval) return;
  void role;
  const latest = await db.query.portalApprovals.findFirst({
    where: and(eq(schema.portalApprovals.orgId, org.id), eq(schema.portalApprovals.kind, kind), eq(schema.portalApprovals.itemId, itemId), ne(schema.portalApprovals.status, 'withdrawn')),
    orderBy: desc(schema.portalApprovals.requestedAt),
  });
  if (latest?.status === 'approved') return;
  const why = !latest ? 'Ask the client to approve it first (Approvals).' : latest.status === 'pending' ? 'It is waiting for the client\'s approval.' : 'The client asked for changes.';
  throw new HttpError(409, `This client approves ${kind === 'page' ? 'pages before they go live' : 'outreach before it is sent'}. ${why}`, 'client_approval_required');
}
