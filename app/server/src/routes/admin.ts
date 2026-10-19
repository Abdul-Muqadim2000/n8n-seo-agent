import { and, desc, eq, gte, gt, or, sql } from 'drizzle-orm';
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
  type AdminPurchaseRequest,
  type CreditLot,
  type CreditSource,
} from '@seo/shared';
import { conflict, HttpError } from '../lib/errors';
import { adminAudit } from '../services/admin/audit';
import { addCreditEntry, creditBalance, listCreditEntries } from '../services/admin/credits';
import { syncCosts } from '../services/admin/costSync';
import { periodRange } from '../services/admin/period';
import { activity, companiesCsv, companyAbsorbed, companyDetail, companyRows, overview, runsPage, userRows } from '../services/admin/reports';
import { getSettings, saveSettings, settingsRow } from '../services/admin/settings';
import { creditGuardTick, grantPlanCredits, requestView } from '../services/billing';
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
    if (body.planMonthlyCredits !== undefined) patch.planMonthlyCredits = body.planMonthlyCredits;
    const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => (org as Record<string, unknown>)[k] !== v));
    if (Object.keys(changed).length) {
      await db.update(schema.organizations).set(changed).where(eq(schema.organizations.id, org.id));
      const before = Object.fromEntries(Object.keys(changed).map((k) => [k, (org as Record<string, unknown>)[k]]));
      await adminAudit(req, 'company.updated', { type: 'company', id: org.id, label: org.name }, { before, after: changed });
      await audit(req, org.id, {
        action: 'company.admin_changed',
        actor: { type: 'platform_admin', userId: req.user?.id ?? null, label: req.user?.email ?? 'platform administrator' },
        target: { type: 'company', id: org.id },
        // the dollar budget is provider cost: never in the customer's own audit log (app/docs/CREDITS.md)
        details: Object.fromEntries(Object.entries(changed).filter(([k]) => k !== 'monthlyBudgetUsd')),
      });
      // a new plan's first month is granted now, not at the guard's next pass
      if (changed.planMonthlyCredits) await grantPlanCredits().catch((err) => req.log.warn({ err: String(err) }, 'plan credits failed'));
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
    const s = await settingsRow();
    const request = body.requestId
      ? await db.query.creditPurchaseRequests.findFirst({ where: and(eq(schema.creditPurchaseRequests.id, body.requestId), eq(schema.creditPurchaseRequests.orgId, org.id)) })
      : null;
    if (body.requestId && (!request || request.status !== 'pending')) throw conflict('That request is not waiting any more.', 'request_resolved');
    if (request && body.kind !== 'grant') throw badRequest('A request is fulfilled with a grant.', { kind: 'Choose grant' });
    // a grant's credits last as chosen: the pack expiry (default), never, or a number of days
    const expiresAt =
      body.kind !== 'grant' || body.expires === 'never'
        ? null
        : body.expires === 'pack'
          ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + s.packExpiryMonths, new Date().getUTCDate()))
          : new Date(Date.now() + body.expires * 86_400_000);
    const source = request || body.paidUsd > 0 ? 'pack' : 'grant';
    // an adjustment down may take the balance below zero only on purpose: it is written as asked, and the panel shows the result
    const row = await addCreditEntry(db, {
      orgId: org.id,
      kind: body.kind,
      credits: body.credits,
      ref: body.kind === 'grant' ? { source, ...(request ? { requestId: request.id } : {}) } : null,
      lot: body.kind === 'grant' ? { source, expiresAt } : undefined,
      refKey: request ? `request:${request.id}` : null,
      paidUsd: body.kind === 'grant' ? body.paidUsd : 0,
      note: body.note || (body.kind === 'grant' ? (body.paidUsd > 0 ? 'Credits bought' : 'Credits granted') : body.kind === 'refund' ? 'Credits refunded' : 'Balance corrected'),
      actor: { userId: admin.id, email: admin.email },
    });
    if (!row) throw new HttpError(500, 'The credits could not be written.');
    if (request)
      await db
        .update(schema.creditPurchaseRequests)
        .set({ status: 'fulfilled', resolvedAt: new Date(), resolvedBy: admin.email, ledgerId: row.id })
        .where(eq(schema.creditPurchaseRequests.id, request.id));
    // credits added: a company whose schedules the guard paused gets them back now, not at its next pass
    if (row.credits > 0) void creditGuardTick(req.log).catch((err) => req.log.warn({ err: String(err) }, 'credit guard after a grant failed'));
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

  // the company's credit lots as the credits page shows them: the ones still holding credits first (soonest to expire first, the order
  // they are used in), then the used-up or expired ones of the last 90 days, newest first
  app.get('/api/admin/companies/:id/lots', async (req): Promise<CreditLot[]> => {
    guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    const L = schema.creditLots;
    const rows = await db.query.creditLots.findMany({
      where: and(eq(L.orgId, org.id), or(gt(L.remaining, 0), gte(L.createdAt, new Date(Date.now() - 90 * 86_400_000)))),
      orderBy: desc(L.createdAt),
      limit: 300,
    });
    const live = (l: (typeof rows)[number]) => l.remaining > 0 && (!l.expiresAt || l.expiresAt.getTime() > Date.now());
    const exp = (l: (typeof rows)[number]) => l.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return rows
      .sort((a, b) => Number(live(b)) - Number(live(a)) || (live(a) ? exp(a) - exp(b) || a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime()))
      .map((l) => ({
        id: l.id,
        source: l.source as CreditSource,
        credits: l.credits,
        remaining: l.remaining,
        expiresAt: l.expiresAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
        note: l.note,
      }));
  });

  // credits runs would have used beyond their quote and were not charged (ref.absorbed on usage entries): ours, in credits and dollars
  app.get('/api/admin/companies/:id/absorbed', async (req) => {
    guard(req);
    const org = await orgOrThrow((req.params as { id: string }).id);
    return companyAbsorbed(periodOf(req.query), org.id);
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

  // credits (app/docs/CREDITS.md): the guard's pass now, instead of at its next 10-minute tick — after confirming a payment, so the
  // company's paused schedules resume at once (also what scripts/credits_e2e.py drives)
  app.post('/api/admin/credits/guard', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    guard(req);
    const r = await creditGuardTick(req.log);
    await adminAudit(req, 'credits.guard_run', { type: 'platform', id: null, label: 'credit guard' }, { ...r });
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
    // compared as JSON: the packs are a list, and a list read back is never the same object (every save looked like a pack change)
    const changed = (Object.keys(body) as (keyof typeof body)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
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

  // ---------- credits: the customers' "Buy credits" requests (fulfilled through POST …/credits with `requestId`) ----------
  app.get('/api/admin/credit-requests', async (req): Promise<AdminPurchaseRequest[]> => {
    guard(req);
    const status = String((req.query as { status?: string }).status ?? 'pending');
    const rows = await db.query.creditPurchaseRequests.findMany({
      where: status === 'all' ? undefined : eq(schema.creditPurchaseRequests.status, status),
      orderBy: desc(schema.creditPurchaseRequests.createdAt),
      limit: 200,
    });
    return rows.map((r) => ({ ...requestView(r), orgId: r.orgId, orgName: r.orgName }));
  });

  app.post('/api/admin/credit-requests/:id/cancel', async (req): Promise<AdminPurchaseRequest> => {
    const admin = guard(req);
    const [row] = await db
      .update(schema.creditPurchaseRequests)
      .set({ status: 'cancelled', resolvedAt: new Date(), resolvedBy: admin.email })
      .where(and(eq(schema.creditPurchaseRequests.id, (req.params as { id: string }).id), eq(schema.creditPurchaseRequests.status, 'pending')))
      .returning()
      .catch(() => []);
    if (!row) throw notFound('No waiting request with this id.');
    await adminAudit(req, 'credits.request_cancelled', { type: 'company', id: row.orgId, label: row.orgName }, { credits: row.credits, packId: row.packId });
    return { ...requestView(row), orgId: row.orgId, orgName: row.orgName };
  });
}

