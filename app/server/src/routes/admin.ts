import { eq, sql } from 'drizzle-orm';
import { audit } from '../services/audit';
import type { FastifyInstance } from 'fastify';
import { orgBudgetSchema, type AdminOrg } from '@seo/shared';
import { isPlatformAdmin, isUuid, requireUser } from '../auth/access';
import { db, schema } from '../db';
import { badRequest, forbidden, notFound, parse } from '../lib/errors';
import { z } from 'zod';
import { emailField } from '@seo/shared';
import { issueToken } from '../auth/tokens';
import { config } from '../config';
import { monthStart } from '../services/runs';
import { loadDeliveryReport } from '../services/delivery';
import {
  adminActivityQuerySchema,
  adminCompanyUpdateSchema,
  adminCreateUserSchema,
  adminCreditSchema,
  adminDeleteCompanySchema,
  adminDeleteUserSchema,
  adminListQuerySchema,
  adminMembershipSchema,
  adminPeriodSchema,
  adminRunsQuerySchema,
  adminUpdateUserSchema,
  platformSettingsSchema,
  type AdminCreatedUser,
  type CreditEntry,
} from '@seo/shared';
import { conflict, HttpError } from '../lib/errors';
import { adminAudit } from '../services/admin/audit';
import { addCreditEntry, creditBalance, listCreditEntries } from '../services/admin/credits';
import { syncCosts } from '../services/admin/costSync';
import { periodRange } from '../services/admin/period';
import { activity, companiesCsv, companyDetail, companyRows, overview, runsPage, userRows } from '../services/admin/reports';
import { getSettings, saveSettings } from '../services/admin/settings';
import { createUser, deleteUser, removeMembership, SET_PASSWORD_HOURS, setMembership, updateUser, userOrThrow } from '../services/admin/users';
import { deleteCompany } from '../services/companyDelete';
import { deleteUserSessions } from '../auth/session';
import { execRows, tsv } from '../services/admin/sqlRows';

/** Platform administration (operators listed in PLATFORM_ADMIN_EMAILS): every company, its usage, budget and status. */
export async function adminRoutes(app: FastifyInstance) {
  const guard = (req: Parameters<typeof requireUser>[0]) => {
    const user = requireUser(req);
    if (!isPlatformAdmin(user)) throw forbidden('Platform administrators only');
    return user;
  };

  const list = async (orgId?: string): Promise<AdminOrg[]> => {
    const since = monthStart();
    const orgs = orgId ? await db.query.organizations.findMany({ where: eq(schema.organizations.id, orgId) }) : await db.query.organizations.findMany();
    // a run counts at what it cost (settled), then the engine's estimate, then the app's — never only the app's reservation; a
    // search-data-only figure counts for no less than the whole-run estimate (the same rule as services/spend.ts and countedRunCost)
    const counts = await execRows<{ org_id: string; members: number; sites: number; runs: number; est: number }>(db, sql`
      select o.id as org_id,
        (select count(*)::int from ${schema.memberships} m where m.org_id = o.id) as members,
        (select count(*)::int from ${schema.sites} s where s.org_id = o.id) as sites,
        (select count(*)::int from ${schema.runs} r where r.org_id = o.id and r.created_at >= ${tsv(since)} and r.status <> 'failed') as runs,
        (select coalesce(sum(case when r.actual_cost_usd is not null and r.actual_cost_partial
            then greatest(r.actual_cost_usd, coalesce(r.engine_cost_estimate_usd, r.estimated_cost_usd))
            else coalesce(r.actual_cost_usd, r.engine_cost_estimate_usd, r.estimated_cost_usd) end), 0)::float from ${schema.runs} r where r.org_id = o.id and r.created_at >= ${tsv(since)} and r.status <> 'failed')
          + (select coalesce(sum(k.cost_usd), 0)::float from ${schema.keywordChecks} k where k.org_id = o.id and k.created_at >= ${tsv(since)} and k.status <> 'failed') as est
      from ${schema.organizations} o`);
    const by = new Map(counts.map((c) => [c.org_id, c]));
    return orgs
      .map((o) => {
        const c = by.get(o.id);
        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          createdAt: o.createdAt.toISOString(),
          members: Number(c?.members ?? 0),
          sites: Number(c?.sites ?? 0),
          monthlyBudgetUsd: o.monthlyBudgetUsd,
          disabled: o.disabled,
          monthEstimatedUsd: Math.round(Number(c?.est ?? 0) * 100) / 100,
          monthRuns: Number(c?.runs ?? 0),
        };
      })
      .sort((a, b) => b.monthEstimatedUsd - a.monthEstimatedUsd || a.name.localeCompare(b.name));
  };

  app.get('/api/admin/orgs', async (req) => {
    guard(req);
    return list();
  });

  app.patch('/api/admin/orgs/:orgId', async (req) => {
    guard(req);
    const orgId = (req.params as { orgId: string }).orgId;
    if (!isUuid(orgId)) throw notFound('Company not found');
    const body = parse(orgBudgetSchema, req.body);
    const rows = await db
      .update(schema.organizations)
      .set({ monthlyBudgetUsd: body.monthlyBudgetUsd, ...(body.disabled !== undefined ? { disabled: body.disabled } : {}) })
      .where(eq(schema.organizations.id, orgId))
      .returning({ id: schema.organizations.id });
    if (!rows.length) throw notFound('Company not found');
    await audit(req, orgId, {
      action: 'company.admin_changed',
      actor: { type: 'platform_admin', userId: req.user?.id ?? null, label: req.user?.email ?? 'platform administrator' },
      target: { type: 'company', id: orgId },
      details: { monthlyBudgetUsd: body.monthlyBudgetUsd, ...(body.disabled !== undefined ? { disabled: body.disabled } : {}) },
    });
    return (await list(orgId))[0];
  });

  // G21 (2026-10-13): runs delivered / runs started per week, for the app's own runs and for the nine schedules, with the schedule
  // fires that left no execution behind (D25a: a Mac-hosted stack misses a Monday whenever the machine sleeps through it) and the
  // channel that carried each ops alert (R6). Internal: operators read it, customers never see it.
  app.get('/api/admin/delivery', async (req) => {
    guard(req);
    return loadDeliveryReport();
  });

  // without account e-mails, a forgotten password is reset with a link the platform admin creates and hands over
  app.post('/api/admin/users/reset-link', async (req) => {
    guard(req);
    const { email } = parse(z.object({ email: emailField }), req.body);
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user) throw notFound(`No account with ${email}`);
    const token = await issueToken(user.id, 'reset_password', 24 * 60);
    return { url: `${config.appUrl}/reset-password?token=${token}`, expiresInHours: 24, name: user.name };
  });

  // ================= the admin panel (2026-10-18, shared/src/admin.ts) =================
  const periodOf = (q: unknown) => periodRange(parse(z.object({ period: adminPeriodSchema }).passthrough(), q ?? {}).period);
  const orgOrThrow = async (id: string) => {
    const o = isUuid(id) ? await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) }) : undefined;
    if (!o) throw notFound('Company not found');
    return o;
  };

  app.get('/api/admin/overview', async (req) => {
    guard(req);
    return overview(periodOf(req.query));
  });

  // ---- companies ----
  app.get('/api/admin/companies', async (req) => {
    guard(req);
    const q = parse(adminListQuerySchema, req.query ?? {});
    return companyRows(periodRange(q.period), { q: q.q });
  });

  app.get('/api/admin/companies/:id', async (req) => {
    guard(req);
    const id = (req.params as { id: string }).id;
    if (!isUuid(id)) throw notFound('Company not found');
    const d = await companyDetail(periodOf(req.query), id);
    if (!d) throw notFound('Company not found');
    return d;
  });

  app.patch('/api/admin/companies/:id', async (req) => {
    guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    const body = parse(adminCompanyUpdateSchema, req.body ?? {});
    const patch: Partial<typeof schema.organizations.$inferInsert> = {};
    if (body.monthlyBudgetUsd !== undefined) patch.monthlyBudgetUsd = body.monthlyBudgetUsd;
    if (body.disabled !== undefined) patch.disabled = body.disabled;
    if (body.creditsEnforced !== undefined) patch.creditsEnforced = body.creditsEnforced;
    if (body.name !== undefined) patch.name = body.name;
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => (org as Record<string, unknown>)[k] !== v));
    if (Object.keys(changed).length) {
      await db.update(schema.organizations).set(changed).where(eq(schema.organizations.id, org.id));
      const before = Object.fromEntries(Object.keys(changed).map((k) => [k, (org as Record<string, unknown>)[k]]));
      await adminAudit(req, 'company.updated', { type: 'company', id: org.id, label: org.name }, { before, after: changed });
      await audit(req, org.id, {
        action: 'company.admin_changed',
        actor: { type: 'platform_admin', userId: req.user?.id ?? null, label: req.user?.email ?? 'platform administrator' },
        target: { type: 'company', id: org.id },
        details: changed,
      });
    }
    return (await companyDetail(periodOf(req.query), org.id))!;
  });

  app.get('/api/admin/companies/:id/credits', async (req): Promise<CreditEntry[]> => {
    guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    return listCreditEntries(org.id, 500);
  });

  app.post('/api/admin/companies/:id/credits', async (req): Promise<CreditEntry> => {
    const admin = guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    const body = parse(adminCreditSchema, req.body ?? {});
    // an adjustment down may take the balance below zero only on purpose: it is written as asked, and the panel shows the result
    const row = await addCreditEntry(db, {
      orgId: org.id,
      kind: body.kind,
      credits: body.credits,
      paidUsd: body.kind === 'grant' ? body.paidUsd : 0,
      note: body.note || (body.kind === 'grant' ? (body.paidUsd > 0 ? 'Credits bought' : 'Credits granted') : body.kind === 'refund' ? 'Credits refunded' : 'Balance corrected'),
      actor: { userId: admin.id, email: admin.email },
    });
    if (!row) throw new HttpError(500, 'The credits could not be written.');
    const balance = await creditBalance(db, org.id);
    await adminAudit(req, `credits.${body.kind === 'grant' ? 'granted' : body.kind === 'refund' ? 'refunded' : 'adjusted'}`, { type: 'company', id: org.id, label: org.name }, {
      credits: row.credits,
      paidUsd: row.paidUsd,
      note: row.note,
      balanceAfter: balance,
    });
    const entries = await listCreditEntries(org.id, 50);
    return entries.find((e) => e.id === row.id) ?? { ...entries[0], id: row.id };
  });

  app.delete('/api/admin/companies/:id', async (req) => {
    guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    const body = parse(adminDeleteCompanySchema, req.body ?? {});
    if (body.confirm !== org.slug) throw badRequest('Type the company slug to confirm', { confirm: `Type ${org.slug}` });
    if (org.kind === 'agency' && (await db.query.organizations.findFirst({ where: eq(schema.organizations.parentOrgId, org.id) })))
      throw conflict('Delete this agency’s client workspaces first.', 'agency_has_clients');
    await deleteCompany(org, req.log);
    await adminAudit(req, 'company.deleted', { type: 'company', id: org.id, label: org.name }, { slug: org.slug, kind: org.kind });
    return { ok: true };
  });

  app.get('/api/admin/export/companies.csv', async (req, reply) => {
    guard(req);
    const r = periodOf(req.query);
    const csv = companiesCsv(await companyRows(r));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="companies-${r.period}-${r.to.toISOString().slice(0, 10)}.csv"`)
      .header('cache-control', 'no-store')
      .send(csv);
  });

  // ---- users ----
  app.get('/api/admin/users', async (req) => {
    guard(req);
    const q = parse(adminListQuerySchema, req.query ?? {});
    return userRows(periodRange(q.period), { q: q.q });
  });

  app.post('/api/admin/users', async (req): Promise<AdminCreatedUser> => {
    guard(req);
    const body = parse(adminCreateUserSchema, req.body ?? {});
    const made = await createUser(req, body);
    await adminAudit(req, 'user.created', { type: 'user', id: made.user.id, label: made.user.email }, {
      company: made.org ? { id: made.org.id, name: made.org.name } : null,
      role: made.org ? (body.newCompanyName ? 'owner' : body.role) : null,
      newCompany: !!body.newCompanyName,
      markVerified: body.markVerified,
    });
    const [row] = await userRows(periodRange('month'), { ids: [made.user.id] });
    return { user: row, setPasswordUrl: made.setPasswordUrl, expiresInHours: SET_PASSWORD_HOURS };
  });

  app.patch('/api/admin/users/:id', async (req) => {
    guard(req);
    const target = await userOrThrow((req.params as { id: string }).id);
    const body = parse(adminUpdateUserSchema, req.body ?? {});
    const changed = await updateUser(req, target, body);
    for (const c of changed)
      await adminAudit(req, c === 'suspended' ? 'user.suspended' : c === 'unsuspended' ? 'user.unsuspended' : c === 'verified' ? 'user.verified' : 'user.renamed', { type: 'user', id: target.id, label: target.email }, c === 'name' ? { before: target.name, after: body.name } : {});
    const [row] = await userRows(periodOf(req.query), { ids: [target.id] });
    return row;
  });

  app.delete('/api/admin/users/:id', async (req) => {
    guard(req);
    const target = await userOrThrow((req.params as { id: string }).id);
    const body = parse(adminDeleteUserSchema, req.body ?? {});
    const out = await deleteUser(req, target, body.soleCompanies);
    await adminAudit(req, 'user.deleted', { type: 'user', id: target.id, label: target.email }, { deletedCompanies: out.deletedCompanies, keptCompanies: out.keptCompanies });
    return { ok: true, ...out };
  });

  app.post('/api/admin/users/:id/sessions/revoke', async (req) => {
    guard(req);
    const target = await userOrThrow((req.params as { id: string }).id);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sessions).where(eq(schema.sessions.userId, target.id));
    await deleteUserSessions(target.id);
    await adminAudit(req, 'user.sessions_revoked', { type: 'user', id: target.id, label: target.email }, { sessions: Number(n), self: target.id === req.user?.id });
    return { ok: true, revoked: Number(n) };
  });

  app.put('/api/admin/users/:id/memberships', async (req) => {
    guard(req);
    const target = await userOrThrow((req.params as { id: string }).id);
    const body = parse(adminMembershipSchema, req.body ?? {});
    const r = await setMembership(req, target, body.orgId, body.role);
    if (r.added || r.before !== body.role) {
      const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, body.orgId) });
      await adminAudit(req, r.added ? 'membership.added' : 'membership.role_changed', { type: 'user', id: target.id, label: target.email }, { company: { id: body.orgId, name: org?.name ?? '' }, role: body.role, before: r.before });
    }
    const [row] = await userRows(periodOf(req.query), { ids: [target.id] });
    return row;
  });

  app.delete('/api/admin/users/:id/memberships/:orgId', async (req) => {
    guard(req);
    const p = req.params as { id: string; orgId: string };
    const target = await userOrThrow(p.id);
    if (!isUuid(p.orgId)) throw notFound('Company not found');
    const role = await removeMembership(req, target, p.orgId);
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, p.orgId) });
    await adminAudit(req, 'membership.removed', { type: 'user', id: target.id, label: target.email }, { company: { id: p.orgId, name: org?.name ?? '' }, role });
    const [row] = await userRows(periodOf(req.query), { ids: [target.id] });
    return row;
  });

  // ---- runs, costs, settings, activity ----
  app.get('/api/admin/runs', async (req) => {
    guard(req);
    const q = parse(adminRunsQuerySchema, req.query ?? {});
    return runsPage(periodRange(q.period), q);
  });

  app.post('/api/admin/costs/sync', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    guard(req);
    const r = await syncCosts({ full: (req.query as { full?: string } | null)?.full === '1' });
    await adminAudit(req, 'costs.synced', { type: 'platform', id: null, label: 'cost sync' }, { ...r });
    return r;
  });

  app.get('/api/admin/settings', async (req) => {
    guard(req);
    return getSettings();
  });

  app.put('/api/admin/settings', async (req) => {
    const admin = guard(req);
    const body = parse(platformSettingsSchema, req.body ?? {});
    const before = await getSettings();
    const after = await saveSettings(body, admin.email);
    const changed = (Object.keys(body) as (keyof typeof body)[]).filter((k) => before[k] !== after[k]);
    if (changed.length)
      await adminAudit(req, 'settings.changed', { type: 'platform', id: null, label: 'platform settings' }, {
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]])),
      });
    return after;
  });

  app.get('/api/admin/activity', async (req) => {
    guard(req);
    return activity(parse(adminActivityQuerySchema, req.query ?? {}).limit);
  });
}
