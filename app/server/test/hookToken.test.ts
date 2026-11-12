import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// S2-10 / S5-05 (prod review 2026-11-12): the company's callback address carries its hook token. It is never stored inside a report
// payload, and an owner or admin can rotate it: the engine's rows of every website are pointed at the new address, the old one keeps
// working for a grace period so runs already in flight still deliver.

const sa = vi.hoisted(() => ({ updates: [] as { table: string; filters: unknown; data: Record<string, unknown> }[], refuse: '' }));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => {
  const real = await orig<typeof import('../src/lib/mailer')>();
  return { ...real, sendMail: vi.fn(async () => true) };
});
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    // a domain named in `sa.refuse` stands for a table the engine could not be asked about (updateRows answers false)
    updateRows: vi.fn(async (table: string, filters: unknown, data: Record<string, unknown>) => (sa.updates.push({ table, filters, data }), !(sa.refuse && JSON.stringify(filters).includes(sa.refuse)))),
    deleteRows: vi.fn(async () => true),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const { orgByHookToken, HOOK_TOKEN_GRACE_MS } = await import('../src/services/runs');
const { reportsHere } = await import('../src/services/data');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

const orgRow = async (id: string) => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) }))!;

describe('the company callback address', () => {
  it('a callback that echoes the address deeper in its body is stored without it, and the report never serves it', async () => {
    const u = await signUp(app, 'hook-store@hook.test');
    const org = (await u.c.post('/api/orgs', { name: 'Hook Store Co' })).body;
    const row = await orgRow(org.id);
    const url = `http://host.docker.internal:4000/api/hooks/n8n/${row.hookToken}`;
    const res = await app.inject({ method: 'POST', url: `/api/hooks/n8n/${row.hookToken}`, payload: { stage: 'ai_visibility', status: 'completed', callback_url: url, state_before: { callback_url: url, note: `sent to ${url}` }, summary_text: 'ok' } });
    expect(res.statusCode).toBeLessThan(300);
    const rep = (await db.query.reports.findFirst({ where: eq(schema.reports.orgId, org.id) }))!;
    expect(JSON.stringify(rep.payload)).not.toContain(row.hookToken);
    const served = await u.c.get(`/api/orgs/${org.id}/reports/${rep.id}`);
    expect(served.status).toBe(200);
    expect(JSON.stringify(served.body)).not.toContain(row.hookToken);
  });

  it('owners and admins rotate the token: every website of the company is pointed at the new address; the old one works for the grace period only', async () => {
    const owner = await signUp(app, 'hook-owner@hook.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Hook Rotate Co' })).body;
    const before = await orgRow(org.id);
    await db.insert(schema.sites).values([
      { orgId: org.id, domain: 'rotate-one.test', country: 'United States', verificationToken: 't1', verifiedAt: new Date() },
      { orgId: org.id, domain: 'rotate-two.test', country: 'United States', verificationToken: 't2', verifiedAt: new Date() },
      { orgId: org.id, domain: 'rotate-unverified.test', country: 'United States', verificationToken: 't3' },
    ]);
    sa.updates.length = 0;
    const r = await owner.c.post(`/api/orgs/${org.id}/hook-token/rotate`, {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sitesUpdated: 2, sitesFailed: [] });
    expect(JSON.stringify(r.body)).not.toContain(before.hookToken);
    const after = await orgRow(org.id);
    expect(after.hookToken).not.toBe(before.hookToken);
    expect(after.previousHookToken).toBe(before.hookToken);
    // the engine's site and ladder rows of both verified websites carry the new address
    const pushed = sa.updates.filter((x) => String(x.data.callback_url ?? '').endsWith(`/api/hooks/n8n/${after.hookToken}`));
    expect(new Set(pushed.map((x) => x.table))).toEqual(new Set(['sites', 'ladders']));
    expect(pushed).toHaveLength(4);
    // the new token is the company's; the old one too, until the grace period ends
    expect((await orgByHookToken(after.hookToken))?.id).toBe(org.id);
    expect((await orgByHookToken(before.hookToken))?.id).toBe(org.id);
    await db.update(schema.organizations).set({ hookTokenRotatedAt: new Date(Date.now() - HOOK_TOKEN_GRACE_MS - 60_000) }).where(eq(schema.organizations.id, org.id));
    expect(await orgByHookToken(before.hookToken)).toBeNull();
    const ev = await db.query.auditEvents.findFirst({ where: eq(schema.auditEvents.action, 'company.hook_token_rotated') });
    expect(ev).toBeTruthy();
    expect(JSON.stringify(ev)).not.toContain(before.hookToken);
    expect(JSON.stringify(ev)).not.toContain(after.hookToken);
  });

  it('a member cannot rotate it', async () => {
    const owner = await signUp(app, 'hook-owner2@hook.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Hook Member Co' })).body;
    const member = await signUp(app, 'hook-member@hook.test');
    const [mu] = await db.select().from(schema.users).where(eq(schema.users.email, 'hook-member@hook.test'));
    await db.insert(schema.memberships).values({ orgId: org.id, userId: mu!.id, role: 'member' });
    const r = await member.c.post(`/api/orgs/${org.id}/hook-token/rotate`, {});
    expect(r.status).toBe(403);
  });

  it('review S3: a report still arriving on the old token re-routes that website (once an hour); a table the engine cannot be asked about is a failure', async () => {
    const owner = await signUp(app, 'hook-owner4@hook.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Hook Heal Co' })).body;
    await db.insert(schema.sites).values([
      { orgId: org.id, domain: 'heal-one.test', country: 'United States', verificationToken: 'h1', verifiedAt: new Date() },
      { orgId: org.id, domain: 'heal-refused.test', country: 'United States', verificationToken: 'h2', verifiedAt: new Date() },
    ]);
    const t0 = (await orgRow(org.id)).hookToken;
    sa.refuse = 'heal-refused.test';
    const r = await owner.c.post(`/api/orgs/${org.id}/hook-token/rotate`, {});
    sa.refuse = '';
    expect(r.body).toMatchObject({ sitesUpdated: 1, sitesFailed: ['heal-refused.test'] });
    const t1 = (await orgRow(org.id)).hookToken;
    // a ladder plan that started before the renewal reports on the old token: stored, and the website's rows get the current address
    sa.updates.length = 0;
    const post = () => app.inject({ method: 'POST', url: `/api/hooks/n8n/${t0}`, payload: { stage: 'rank_tracker', status: 'completed', domain: 'heal-one.test' } });
    expect((await post()).statusCode).toBeLessThan(300);
    await vi.waitFor(() => expect(sa.updates.filter((x) => String(x.data.callback_url ?? '').endsWith(t1) && JSON.stringify(x.filters).includes('heal-one.test')).map((x) => x.table).sort()).toEqual(['ladders', 'sites']));
    // within the hour, no second re-route
    sa.updates.length = 0;
    expect((await post()).statusCode).toBeLessThan(300);
    await new Promise((res) => setTimeout(res, 50));
    expect(sa.updates).toEqual([]);
    // a report on the current token re-routes nothing
    expect((await app.inject({ method: 'POST', url: `/api/hooks/n8n/${t1}`, payload: { stage: 'rank_tracker', status: 'completed', domain: 'heal-one.test' } })).statusCode).toBeLessThan(300);
    await new Promise((res) => setTimeout(res, 50));
    expect(sa.updates).toEqual([]);
  });

  it('review S3: "reports go to this app" only when the site row and every ladder row carry the current address', () => {
    const cur = 'https://app.example.test/api/hooks/n8n/current-token-0000000000';
    const old = 'https://app.example.test/api/hooks/n8n/old-token-00000000000000';
    expect(reportsHere({ callback_url: cur }, [{ callback_url: cur }, { callback_url: '' }], cur)).toBe(true);
    expect(reportsHere({ callback_url: cur }, [{ callback_url: cur }, { callback_url: old }], cur)).toBe(false);
    expect(reportsHere({ callback_url: old }, [], cur)).toBe(false);
    expect(reportsHere(null, [], cur)).toBe(false);
  });
});
