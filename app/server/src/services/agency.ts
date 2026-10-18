import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  brandingOf,
  brandTokens,
  clientBrandingOf,
  clientSafePayload,
  effectiveBrand,
  isClientRole,
  isStaffRole,
  orgKindOf,
  policyOf,
  roleAtLeast,
  type AgencyClient,
  type AgencyOverviewRow,
  type AssignableRole,
  type Org,
  type OrgSummary,
  type PortalBrand,
  type Role,
  type StaffAccess,
} from '@seo/shared';
import { refreshSessionPolicy } from '../auth/session';
import type { OrgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, UserRow } from '../db/schema';
import { randomToken, slugify } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { audit } from './audit';
import { agencyOf, brandForOrg } from './brandOf';
import { monthStart, orgSpendSince } from './spend';

/**
 * G5 (app/docs/WHITE_LABEL.md): agencies and their client workspaces. A client workspace is an ordinary company with a parent; the
 * access rule lives in auth/access.ts (`orgAccess`), this file holds what an agency does with its clients.
 */

export { agencyOf, brandForOrg, orgById, payloadFor } from './brandOf';

export function toOrg(o: OrgRow, role: Role, ctx: { agency?: OrgRow | null; brand?: PortalBrand | null } = {}): Org {
  const kind = orgKindOf(o.kind);
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    industry: o.industry,
    size: o.size,
    website: o.website,
    // a client person never sees what the agency budgets for them
    monthlyBudgetUsd: isClientRole(role) ? 0 : o.monthlyBudgetUsd,
    disabled: o.disabled,
    onboardingStep: o.onboardingStep,
    onboardedAt: o.onboardedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    role,
    kind,
    agency: kind === 'client' && ctx.agency ? (isClientRole(role) ? { name: ctx.agency.name } : { name: ctx.agency.name, id: ctx.agency.id }) : null,
    brand: ctx.brand ?? null,
    clientApproval: kind === 'client' ? o.clientApproval : false,
  };
}

/** the full answer for GET /api/orgs/:id (with the agency and the brand) */
export async function orgView(o: OrgRow, role: Role): Promise<Org> {
  const agency = await agencyOf(o);
  return toOrg(o, role, { agency, brand: await brandForOrg(o) });
}

// ---------------------------------------------------------------------------------------------------------------------------
// The companies a person sees in their switcher (`/api/me`)
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Direct memberships, as before, with two G5 rules: a staff assignment in a client workspace is reached through the agency (not
 * listed on its own), and on a portal host only that agency and its clients are listed.
 */
export async function orgSummaries(userId: string, portalOrgId: string | null): Promise<OrgSummary[]> {
  const rows = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.userId, userId), isNull(schema.memberships.deactivatedAt)))
    .orderBy(asc(schema.organizations.name));
  const parents = new Map<string, string>();
  const parentIds = [...new Set(rows.map((r) => r.org.parentOrgId).filter(Boolean) as string[])];
  if (parentIds.length)
    for (const p of await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, parentIds))) parents.set(p.id, p.name);
  return rows
    .filter((r) => !(r.org.kind === 'client' && isStaffRole(r.role)))
    .filter((r) => !(r.org.kind !== 'client' && isClientRole(r.role)))
    .filter((r) => !portalOrgId || r.org.id === portalOrgId || r.org.parentOrgId === portalOrgId)
    .map((r) => ({
      id: r.org.id,
      name: r.org.name,
      slug: r.org.slug,
      role: r.role as Role,
      onboardingStep: r.org.onboardingStep,
      onboardedAt: r.org.onboardedAt?.toISOString() ?? null,
      requiresMfa: policyOf(r.org.securityPolicy).requireMfa,
      kind: orgKindOf(r.org.kind),
      agencyName: r.org.parentOrgId ? (parents.get(r.org.parentOrgId) ?? null) : null,
    }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Agency mode and client workspaces
// ---------------------------------------------------------------------------------------------------------------------------

export async function enableAgency(req: FastifyRequest, a: OrgAccess): Promise<OrgRow> {
  if (a.role !== 'owner') throw forbidden('Only the owner can turn a company into an agency.');
  if (a.org.kind === 'client') throw badRequest('A client workspace cannot become an agency.');
  if (a.org.kind === 'agency') return a.org;
  const [o] = await db.update(schema.organizations).set({ kind: 'agency' }).where(eq(schema.organizations.id, a.org.id)).returning();
  await audit(req, a.org.id, { action: 'agency.enabled', target: { type: 'company', id: a.org.id, label: a.org.name } });
  return o;
}

export function requireAgency(a: OrgAccess, min: Role = 'viewer'): void {
  if (a.org.kind !== 'agency') throw notFound('This company is not an agency.');
  if (!roleAtLeast(a.role, min)) throw forbidden(`This needs the ${min} role or higher`);
}

/** the client workspaces a person may open from this agency: all for owners / admins, assigned ones for members / viewers */
export async function visibleClients(a: OrgAccess): Promise<OrgRow[]> {
  const all = await db.query.organizations.findMany({ where: and(eq(schema.organizations.parentOrgId, a.org.id), eq(schema.organizations.kind, 'client')), orderBy: asc(schema.organizations.name) });
  if (roleAtLeast(a.role, 'admin')) return all;
  if (!all.length) return [];
  const mine = await db
    .select({ orgId: schema.memberships.orgId, role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, a.user.id), inArray(schema.memberships.orgId, all.map((o) => o.id)), isNull(schema.memberships.deactivatedAt)));
  const ids = new Set(mine.filter((m) => isStaffRole(m.role)).map((m) => m.orgId));
  return all.filter((o) => ids.has(o.id));
}

async function roleIn(a: OrgAccess, client: OrgRow): Promise<Role> {
  if (a.role === 'owner' || a.role === 'admin') return a.role;
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, client.id), eq(schema.memberships.userId, a.user.id)) });
  return (m?.role as Role) ?? 'viewer';
}

export async function listClients(a: OrgAccess): Promise<AgencyClient[]> {
  const clients = await visibleClients(a);
  if (!clients.length) return [];
  const ids = clients.map((c) => c.id);
  const siteCounts = new Map(
    (await db.select({ orgId: schema.sites.orgId, n: sql<number>`count(*)::int` }).from(schema.sites).where(inArray(schema.sites.orgId, ids)).groupBy(schema.sites.orgId)).map((r) => [r.orgId, Number(r.n)]),
  );
  const people = await db
    .select({ orgId: schema.memberships.orgId, role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(inArray(schema.memberships.orgId, ids), isNull(schema.memberships.deactivatedAt)));
  const out: AgencyClient[] = [];
  for (const c of clients) {
    const p = people.filter((x) => x.orgId === c.id);
    out.push({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
      sites: siteCounts.get(c.id) ?? 0,
      clientPeople: p.filter((x) => isClientRole(x.role)).length,
      staff: p.filter((x) => isStaffRole(x.role)).length,
      monthlyBudgetUsd: c.monthlyBudgetUsd,
      spentUsd: Math.round((await orgSpendSince(db, c.id)).total * 100) / 100,
      clientApproval: c.clientApproval,
      role: await roleIn(a, c),
    });
  }
  return out;
}

export async function createClient(req: FastifyRequest, a: OrgAccess, body: { name: string; monthlyBudgetUsd?: number; website: string }): Promise<OrgRow> {
  requireAgency(a, 'admin');
  const budget = body.monthlyBudgetUsd ?? config.defaultBudgetUsd;
  // the agency owner sets budgets anyway; an admin stays within what an owner could set on their own
  if (budget > config.ownerBudgetMaxUsd) throw badRequest(`A client's monthly budget can be up to $${config.ownerBudgetMaxUsd}; for more, ask the platform administrator.`, { monthlyBudgetUsd: `At most $${config.ownerBudgetMaxUsd}` });
  const base = slugify(body.name);
  let slug = base;
  for (let i = 0; i < 5 && (await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, slug) })); i++) slug = `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const [o] = await db
    .insert(schema.organizations)
    .values({
      name: body.name,
      slug,
      website: body.website,
      hookToken: randomToken(24),
      monthlyBudgetUsd: budget,
      // set up by the agency from its own screens: no onboarding wizard for a client workspace
      onboardingStep: 'done',
      onboardedAt: new Date(),
      createdBy: a.user.id,
      kind: 'client',
      parentOrgId: a.org.id,
    })
    .returning();
  await audit(req, a.org.id, { action: 'agency.client_created', target: { type: 'company', id: o.id, label: o.name }, details: { monthlyBudgetUsd: budget } });
  await audit(req, o.id, { action: 'company.created', target: { type: 'company', id: o.id, label: o.name }, details: { agency: a.org.name } });
  return o;
}

export async function clientOf(a: OrgAccess, clientId: string): Promise<OrgRow> {
  const c = await db.query.organizations.findFirst({ where: and(eq(schema.organizations.id, clientId), eq(schema.organizations.parentOrgId, a.org.id), eq(schema.organizations.kind, 'client')) });
  if (!c) throw notFound('Client not found');
  return c;
}

// ---- staff of the agency in one client ----
export async function staffAccess(a: OrgAccess, client: OrgRow): Promise<StaffAccess[]> {
  const staff = await db
    .select({ m: schema.memberships, u: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, a.org.id), isNull(schema.memberships.deactivatedAt)))
    .orderBy(asc(schema.memberships.createdAt));
  const assigned = new Map(
    (await db.select({ userId: schema.memberships.userId, role: schema.memberships.role }).from(schema.memberships).where(eq(schema.memberships.orgId, client.id)))
      .filter((r) => isStaffRole(r.role))
      .map((r) => [r.userId, r.role as Role]),
  );
  return staff.map(({ m, u }) => {
    const agencyRole = m.role as Role;
    const inherited = agencyRole === 'owner' || agencyRole === 'admin';
    const own = assigned.get(u.id) ?? null;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      agencyRole,
      access: inherited ? 'inherited' : own ? 'assigned' : 'none',
      role: inherited ? agencyRole : own,
    };
  });
}

export async function assignStaff(req: FastifyRequest, a: OrgAccess, client: OrgRow, userId: string, role: AssignableRole | null): Promise<void> {
  requireAgency(a, 'admin');
  const am = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, userId)) });
  if (!am || am.deactivatedAt) throw notFound('Not a member of the agency');
  if (am.role === 'owner' || am.role === 'admin') throw badRequest('Owners and admins of the agency reach every client already.');
  const existing = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, client.id), eq(schema.memberships.userId, userId)) });
  if (existing && isClientRole(existing.role)) throw conflict('This person is one of the client’s own people in this workspace.');
  const who = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (role === null) {
    if (existing) await db.delete(schema.memberships).where(and(eq(schema.memberships.orgId, client.id), eq(schema.memberships.userId, userId)));
    await audit(req, a.org.id, { action: 'agency.staff_unassigned', target: { type: 'user', id: userId, label: who?.email ?? null }, details: { client: client.name } });
  } else {
    if (existing) await db.update(schema.memberships).set({ role }).where(and(eq(schema.memberships.orgId, client.id), eq(schema.memberships.userId, userId)));
    else await db.insert(schema.memberships).values({ orgId: client.id, userId, role, provisionedBy: 'owner' });
    await audit(req, a.org.id, { action: 'agency.staff_assigned', target: { type: 'user', id: userId, label: who?.email ?? null }, details: { client: client.name, role } });
  }
  await refreshSessionPolicy([userId]);
}

/** someone left the agency: their assignments in its clients go with them */
export async function dropAssignments(agencyId: string, userId: string): Promise<void> {
  const clients = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.parentOrgId, agencyId));
  if (!clients.length) return;
  const ids = clients.map((c) => c.id);
  const rows = await db.select().from(schema.memberships).where(and(eq(schema.memberships.userId, userId), inArray(schema.memberships.orgId, ids)));
  for (const r of rows.filter((x) => isStaffRole(x.role))) await db.delete(schema.memberships).where(and(eq(schema.memberships.orgId, r.orgId), eq(schema.memberships.userId, userId)));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------------------------------------------------------

export function brandingView(org: OrgRow) {
  if (org.kind === 'client') {
    const b = clientBrandingOf(org.branding);
    return { kind: 'client' as const, branding: b, clientApproval: org.clientApproval, contrast: b.accent ? (brandTokens(b.accent)?.contrast ?? null) : null };
  }
  const b = brandingOf(org.branding);
  return { kind: 'agency' as const, branding: b, contrast: b.accent ? (brandTokens(b.accent)?.contrast ?? null) : null };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The overview: every client's websites in one table, from the app's own database (no engine call: it must load for 200 clients)
// ---------------------------------------------------------------------------------------------------------------------------

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function agencyOverview(a: OrgAccess, now = new Date()): Promise<AgencyOverviewRow[]> {
  requireAgency(a);
  const clients = await visibleClients(a);
  if (!clients.length) return [];
  const ids = clients.map((c) => c.id);
  const sites = await db.query.sites.findMany({ where: inArray(schema.sites.orgId, ids), orderBy: asc(schema.sites.domain) });
  const siteIds = sites.map((s) => s.id);
  const since = new Date(now.getTime() - 120 * 864e5);
  const reports = siteIds.length
    ? await db
        .select({ siteId: schema.reports.siteId, stage: schema.reports.stage, summary: schema.reports.summary, at: schema.reports.receivedAt })
        .from(schema.reports)
        .where(
          and(
            inArray(schema.reports.siteId, siteIds),
            inArray(schema.reports.stage, ['site_audit', 'full_report', 'rank_tracker', 'site_tracker', 'ai_visibility', 'ai_pulse', 'console_alert']),
            gte(schema.reports.receivedAt, since),
          ),
        )
        .orderBy(desc(schema.reports.receivedAt))
        .limit(5000)
    : [];
  const latest = (siteId: string, stages: string[]) => reports.find((r) => r.siteId === siteId && stages.includes(r.stage));
  const alertSince = new Date(now.getTime() - 14 * 864e5);
  const pending = await db
    .select({ orgId: schema.portalApprovals.orgId, siteId: schema.portalApprovals.siteId, n: sql<number>`count(*)::int` })
    .from(schema.portalApprovals)
    .where(and(inArray(schema.portalApprovals.orgId, ids), eq(schema.portalApprovals.status, 'pending')))
    .groupBy(schema.portalApprovals.orgId, schema.portalApprovals.siteId);
  const spend = new Map<string, number>();
  for (const c of clients) spend.set(c.id, Math.round((await orgSpendSince(db, c.id, monthStart(now))).total * 100) / 100);
  const rows: AgencyOverviewRow[] = [];
  for (const c of clients) {
    const own = sites.filter((s) => s.orgId === c.id);
    const base = { clientId: c.id, clientName: c.name, spentUsd: spend.get(c.id) ?? 0, budgetUsd: c.monthlyBudgetUsd };
    if (!own.length) {
      rows.push({
        ...base,
        siteId: null,
        domain: null,
        verified: false,
        tracking: null,
        healthScore: null,
        healthAt: null,
        rankGains: null,
        rankDrops: null,
        clicksPct: null,
        aiVisibility: null,
        aiMentionRate: null,
        alerts14d: 0,
        approvalsWaiting: pending.filter((p) => p.orgId === c.id).reduce((t, p) => t + Number(p.n), 0),
      });
      continue;
    }
    for (const s of own) {
      const audit = latest(s.id, ['site_audit', 'full_report']);
      const rank = latest(s.id, ['rank_tracker']);
      const track = latest(s.id, ['site_tracker']);
      const ai = latest(s.id, ['ai_visibility']);
      const alerts = reports.filter((r) => r.siteId === s.id && r.at >= alertSince && (r.stage === 'console_alert' || (r.stage === 'ai_pulse' && (num(r.summary.alerts) ?? 0) > 0))).length;
      rows.push({
        ...base,
        siteId: s.id,
        domain: s.domain,
        verified: !!s.verifiedAt,
        tracking: s.trackingStatus,
        healthScore: num(audit?.summary.healthScore),
        healthAt: audit?.at.toISOString() ?? null,
        rankGains: num(rank?.summary.gains),
        rankDrops: num(rank?.summary.drops),
        clicksPct: num(track?.summary.clicksPct),
        aiVisibility: num(ai?.summary.visibilityScore),
        aiMentionRate: num(ai?.summary.mentionRate),
        alerts14d: alerts,
        approvalsWaiting: pending.filter((p) => p.orgId === c.id && p.siteId === s.id).reduce((t, p) => t + Number(p.n), 0),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------------
// What a client person may be served
// ---------------------------------------------------------------------------------------------------------------------------

/** whether a person may delete a client workspace through the company route: the agency's owner */
export async function canDeleteClient(user: UserRow, client: OrgRow): Promise<boolean> {
  if (client.kind !== 'client' || !client.parentOrgId) return false;
  const am = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, client.parentOrgId), eq(schema.memberships.userId, user.id)) });
  return !!am && !am.deactivatedAt && am.role === 'owner';
}
