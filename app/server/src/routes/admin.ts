import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { orgBudgetSchema, type AdminOrg } from '@seo/shared';
import { isPlatformAdmin, isUuid, requireUser } from '../auth/access';
import { db, schema } from '../db';
import { forbidden, notFound, parse } from '../lib/errors';
import { z } from 'zod';
import { emailField } from '@seo/shared';
import { issueToken } from '../auth/tokens';
import { config } from '../config';
import { monthStart } from '../services/runs';

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
    const counts = await db.execute<{ org_id: string; members: number; sites: number; runs: number; est: number }>(sql`
      select o.id as org_id,
        (select count(*)::int from ${schema.memberships} m where m.org_id = o.id) as members,
        (select count(*)::int from ${schema.sites} s where s.org_id = o.id) as sites,
        (select count(*)::int from ${schema.runs} r where r.org_id = o.id and r.created_at >= ${since} and r.status <> 'failed') as runs,
        (select coalesce(sum(r.estimated_cost_usd), 0)::float from ${schema.runs} r where r.org_id = o.id and r.created_at >= ${since} and r.status <> 'failed')
          + (select coalesce(sum(k.cost_usd), 0)::float from ${schema.keywordChecks} k where k.org_id = o.id and k.created_at >= ${since} and k.status <> 'failed') as est
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
    return (await list(orgId))[0];
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

}
