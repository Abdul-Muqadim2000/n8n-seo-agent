import { and, asc, desc, eq, gt, gte, isNull, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createOrgSchema,
  estimateMonitoringCost,
  inviteSchema,
  updateMemberSchema,
  updateOrgSchema,
  type Invitation,
  type MonitorsRow,
  type InvitationPreview,
  type Member,
  type ModeId,
  type Org,
  type Role,
  type Usage,
} from '@seo/shared';
import { isPlatformAdmin, isUuid, orgAccess, requireUser } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow } from '../db/schema';
import { randomToken, sha256, slugify } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound, parse } from '../lib/errors';
import { siteRows } from '../n8n/client';
import { stopInEngine } from './sites';
import { monitorsFromRow } from '../services/data';
import { sendMail } from '../lib/mailer';
import { acceptInvitation } from '../services/invitations';
import { monthStart } from '../services/runs';

export function toOrg(o: OrgRow, role: Role): Org {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    industry: o.industry,
    size: o.size,
    website: o.website,
    monthlyBudgetUsd: o.monthlyBudgetUsd,
    disabled: o.disabled,
    onboardingStep: o.onboardingStep,
    onboardedAt: o.onboardedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    role,
  };
}

const ONBOARDING_STEPS = ['company', 'website', 'verify', 'business', 'profile', 'tracking', 'launch', 'done'] as const;

export async function orgRoutes(app: FastifyInstance) {
  app.post('/api/orgs', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const body = parse(createOrgSchema, req.body);
    if (!isPlatformAdmin(user)) {
      // invite-only platforms: companies are created by the platform admin; open platforms: a few per person
      if (!config.allowSignup) throw forbidden('New companies are created by the platform administrator.');
      const owned = await db.select({ id: schema.memberships.orgId }).from(schema.memberships).where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.role, 'owner')));
      if (owned.length >= config.maxCompaniesPerUser) throw forbidden(`You already own ${owned.length} companies, the most one person can create. Ask the platform administrator for more.`);
    }
    const base = slugify(body.name);
    let slug = base;
    for (let i = 0; i < 5 && (await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, slug) })); i++) slug = `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const org = await db.transaction(async (tx) => {
      const [o] = await tx
        .insert(schema.organizations)
        .values({
          name: body.name,
          slug,
          industry: body.industry,
          size: body.size,
          website: body.website,
          hookToken: randomToken(24),
          monthlyBudgetUsd: config.defaultBudgetUsd,
          onboardingStep: 'website',
          createdBy: user.id,
        })
        .returning();
      await tx.insert(schema.memberships).values({ orgId: o.id, userId: user.id, role: 'owner' });
      return o;
    });
    return toOrg(org, 'owner');
  });

  app.get('/api/orgs/:orgId', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    return toOrg(a.org, a.role);
  });

  app.patch('/api/orgs/:orgId', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const body = parse(updateOrgSchema, req.body);
    const [o] = await db
      .update(schema.organizations)
      .set({ ...(body.name ? { name: body.name } : {}), ...(body.industry !== undefined ? { industry: body.industry } : {}), ...(body.size !== undefined ? { size: body.size } : {}), ...(body.website !== undefined ? { website: body.website } : {}) })
      .where(eq(schema.organizations.id, a.org.id))
      .returning();
    return toOrg(o, a.role);
  });

  app.delete('/api/orgs/:orgId', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'owner');
    const body = parse(z.object({ confirm: z.string() }), req.body ?? {});
    if (body.confirm.trim() !== a.org.name) throw badRequest('Type the company name to confirm', { confirm: 'Does not match the company name' });
    // stop the weekly workflows of its verified websites (their history in n8n stays), then remove everything of the company
    // every verified website: its weekly runs, ladders and monitors stop in the engine (history stays)
    const owned = await db.query.sites.findMany({ where: eq(schema.sites.orgId, a.org.id) });
    for (const s of owned.filter((x) => x.verifiedAt)) await stopInEngine(s, req.log);
    await db.delete(schema.organizations).where(eq(schema.organizations.id, a.org.id));
    return { ok: true };
  });

  app.patch('/api/orgs/:orgId/onboarding', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const body = parse(z.object({ step: z.enum(ONBOARDING_STEPS), done: z.boolean().optional() }), req.body);
    const [o] = await db
      .update(schema.organizations)
      .set({ onboardingStep: body.step, ...(body.done ? { onboardedAt: a.org.onboardedAt ?? new Date() } : {}) })
      .where(eq(schema.organizations.id, a.org.id))
      .returning();
    return toOrg(o, a.role);
  });

  app.patch('/api/orgs/:orgId/budget', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'owner');
    const body = parse(z.object({ monthlyBudgetUsd: z.number().min(0).max(100000) }), req.body);
    if (body.monthlyBudgetUsd > config.ownerBudgetMaxUsd && !isPlatformAdmin(a.user))
      throw badRequest(`Owners can set up to $${config.ownerBudgetMaxUsd} a month; for more, ask the platform administrator.`, { monthlyBudgetUsd: `At most $${config.ownerBudgetMaxUsd}` });
    const [o] = await db.update(schema.organizations).set({ monthlyBudgetUsd: body.monthlyBudgetUsd }).where(eq(schema.organizations.id, a.org.id)).returning();
    return toOrg(o, a.role);
  });

  app.get('/api/orgs/:orgId/usage', async (req): Promise<Usage> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    const since = monthStart();
    const runs = await db
      .select({ mode: schema.runs.mode, est: schema.runs.estimatedCostUsd, act: schema.runs.actualCostUsd, status: schema.runs.status, createdAt: schema.runs.createdAt })
      .from(schema.runs)
      .where(and(eq(schema.runs.orgId, a.org.id), gte(schema.runs.createdAt, since), ne(schema.runs.status, 'failed')));
    const byMode = new Map<string, { runs: number; est: number }>();
    const daily = new Map<string, { runs: number; est: number }>();
    for (const r of runs) {
      const m = byMode.get(r.mode) ?? { runs: 0, est: 0 };
      m.runs += 1;
      m.est += r.est;
      byMode.set(r.mode, m);
      const day = r.createdAt.toISOString().slice(0, 10);
      const d = daily.get(day) ?? { runs: 0, est: 0 };
      d.runs += 1;
      d.est += r.est;
      daily.set(day, d);
    }
    // keyword checks (the "New keyword ladder" flow) count in the month and per day, not as runs
    const checks = await db
      .select({ usd: schema.keywordChecks.costUsd, createdAt: schema.keywordChecks.createdAt })
      .from(schema.keywordChecks)
      .where(and(eq(schema.keywordChecks.orgId, a.org.id), gte(schema.keywordChecks.createdAt, since), ne(schema.keywordChecks.status, 'failed')));
    for (const c of checks) {
      const day = c.createdAt.toISOString().slice(0, 10);
      const d = daily.get(day) ?? { runs: 0, est: 0 };
      d.est += c.usd;
      daily.set(day, d);
    }
    const checksUsd = checks.reduce((t, c) => t + c.usd, 0);
    const tracked = await db.query.sites.findMany({ where: and(eq(schema.sites.orgId, a.org.id), eq(schema.sites.trackingStatus, 'active')) });
    // the background monitors as saved for each tracked (verified) site; defaults (everything on) when none are saved
    const monitoring = await Promise.all(
      tracked
        .filter((s) => s.verifiedAt)
        .map(async (s) => {
          const m = monitorsFromRow((await siteRows<MonitorsRow>('monitors', s.domain, { max: 5 }).catch(() => []))[0]);
          return estimateMonitoringCost({ aiVisibility: m?.aiVisibility ?? true, backlinks: m?.backlinks ?? true, auditMonthly: m?.auditMonthly ?? true, blogsPerWeek: s.blogsPerWeek });
        }),
    );
    const estimated = runs.reduce((t, r) => t + r.est, 0) + checksUsd;
    const round = (x: number) => Math.round(x * 100) / 100;
    return {
      month: since.toISOString().slice(0, 7),
      budgetUsd: a.org.monthlyBudgetUsd,
      estimatedUsd: round(estimated),
      actualUsd: round(runs.reduce((t, r) => t + (r.act ?? 0), 0)),
      remainingUsd: round(Math.max(0, a.org.monthlyBudgetUsd - estimated)),
      runs: runs.length,
      byMode: [...byMode.entries()].map(([mode, v]) => ({ mode: mode as ModeId, runs: v.runs, estimatedUsd: round(v.est) })).sort((x, y) => y.estimatedUsd - x.estimatedUsd),
      daily: [...daily.entries()].map(([date, v]) => ({ date, runs: v.runs, estimatedUsd: round(v.est) })).sort((x, y) => x.date.localeCompare(y.date)),
      monitoringMonthlyUsd: round(monitoring.reduce((t, x) => t + x, 0)),
      keywordChecks: { checks: checks.length, usd: round(checksUsd) },
    };
  });

  // ---------- team ----------
  app.get('/api/orgs/:orgId/members', async (req): Promise<{ members: Member[]; invitations: Invitation[] }> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    const members = await db
      .select({ m: schema.memberships, u: schema.users })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(eq(schema.memberships.orgId, a.org.id))
      .orderBy(asc(schema.memberships.createdAt));
    const invites =
      a.role === 'viewer'
        ? []
        : await db
            .select({ i: schema.invitations, by: schema.users.name })
            .from(schema.invitations)
            .leftJoin(schema.users, eq(schema.invitations.invitedBy, schema.users.id))
            .where(and(eq(schema.invitations.orgId, a.org.id), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt), gt(schema.invitations.expiresAt, new Date())))
            .orderBy(desc(schema.invitations.createdAt));
    return {
      members: members.map(({ m, u }) => ({ userId: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, role: m.role as Role, joinedAt: m.createdAt.toISOString() })),
      invitations: invites.map(({ i, by }) => ({ id: i.id, email: i.email, role: i.role as Role, invitedBy: by, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() })),
    };
  });

  app.post('/api/orgs/:orgId/invitations', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req): Promise<Invitation> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const body = parse(inviteSchema, req.body);
    const already = await db
      .select({ id: schema.users.id })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(and(eq(schema.memberships.orgId, a.org.id), eq(schema.users.email, body.email)))
      .limit(1);
    if (already.length) throw conflict(`${body.email} is already a member of ${a.org.name}.`);
    // one open invitation per address: a new one replaces the old link
    await db
      .update(schema.invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitations.orgId, a.org.id), eq(schema.invitations.email, body.email), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt)));
    const token = randomToken(32);
    const [inv] = await db
      .insert(schema.invitations)
      .values({ orgId: a.org.id, email: body.email, role: body.role, tokenHash: sha256(token), invitedBy: a.user.id, expiresAt: new Date(Date.now() + 7 * 864e5) })
      .returning();
    const inviteUrl = `${config.appUrl}/invite/${token}`;
    void sendMail(
      {
        to: body.email,
        subject: `${a.user.name} invited you to ${a.org.name} on ${config.brand}`,
        lines: [`${a.user.name} invited you to join ${a.org.name} as ${body.role}.`, 'You will see the SEO dashboards, reports and analyses of the company’s websites.'],
        action: { label: 'Accept the invitation', url: inviteUrl },
        footer: 'The invitation works for 7 days.',
      },
      req.log,
    );
    return { id: inv.id, email: inv.email, role: inv.role as Role, invitedBy: a.user.name, createdAt: inv.createdAt.toISOString(), expiresAt: inv.expiresAt.toISOString(), inviteUrl };
  });

  app.delete('/api/orgs/:orgId/invitations/:id', async (req) => {
    const p = req.params as { orgId: string; id: string };
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.id)) throw notFound('Invitation not found');
    await db.update(schema.invitations).set({ revokedAt: new Date() }).where(and(eq(schema.invitations.id, p.id), eq(schema.invitations.orgId, a.org.id)));
    return { ok: true };
  });

  app.patch('/api/orgs/:orgId/members/:userId', async (req) => {
    const p = req.params as { orgId: string; userId: string };
    const a = await orgAccess(req, p.orgId, 'admin');
    const body = parse(updateMemberSchema, req.body);
    if (!isUuid(p.userId)) throw notFound('Member not found');
    const target = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, p.userId)) });
    if (!target) throw notFound('Member not found');
    if (target.role === 'owner') throw forbidden('The owner’s role cannot be changed.');
    if (target.userId === a.user.id) throw badRequest('You cannot change your own role.');
    await db.update(schema.memberships).set({ role: body.role }).where(and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, p.userId)));
    return { ok: true };
  });

  app.delete('/api/orgs/:orgId/members/:userId', async (req) => {
    const p = req.params as { orgId: string; userId: string };
    const self = requireUser(req).id === p.userId;
    const a = await orgAccess(req, p.orgId, self ? 'viewer' : 'admin');
    if (!isUuid(p.userId)) throw notFound('Member not found');
    const target = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, p.userId)) });
    if (!target) throw notFound('Member not found');
    if (target.role === 'owner') throw forbidden(self ? 'The owner cannot leave the company.' : 'The owner cannot be removed.');
    await db.delete(schema.memberships).where(and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, p.userId)));
    return { ok: true };
  });

  // ---------- invitation links ----------
  app.get('/api/invitations/:token', async (req): Promise<InvitationPreview> => {
    const token = (req.params as { token: string }).token;
    const inv = token.length < 100 ? await db.query.invitations.findFirst({ where: eq(schema.invitations.tokenHash, sha256(token)) }) : undefined;
    if (!inv) throw notFound('This invitation link is not valid.');
    const [org, inviter] = await Promise.all([
      db.query.organizations.findFirst({ where: eq(schema.organizations.id, inv.orgId) }),
      inv.invitedBy ? db.query.users.findFirst({ where: eq(schema.users.id, inv.invitedBy) }) : Promise.resolve(undefined),
    ]);
    const reason = inv.acceptedAt ? 'This invitation was already accepted.' : inv.revokedAt ? 'This invitation was withdrawn.' : inv.expiresAt < new Date() ? 'This invitation has expired. Ask for a new one.' : null;
    return { orgName: org?.name ?? 'Unknown company', email: inv.email, role: inv.role as Role, inviterName: inviter?.name ?? null, valid: !reason, reason };
  });

  app.post('/api/invitations/:token/accept', async (req) => {
    const user = requireUser(req);
    const token = (req.params as { token: string }).token;
    const inv = token.length < 100 ? await db.query.invitations.findFirst({ where: eq(schema.invitations.tokenHash, sha256(token)) }) : undefined;
    if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) throw badRequest('This invitation is no longer valid.');
    if (inv.email !== user.email.toLowerCase()) throw forbidden(`This invitation is for ${inv.email}. Sign in with that address.`);
    return { orgId: await acceptInvitation(inv, user) };
  });

}
