import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// CR17-I (client report 2026-11-17): one "credits used" figure on every screen (F7), the forecast from the ledger (M2), the automatic
// top-up request (one per low episode), the daily pulse's cost split per website, a request confirmed with another amount shows what was
// added, and "Track my site" saved with an empty list clears it (F8). Real Postgres (PGlite, every migration).

const sa = vi.hoisted(() => ({ mails: [] as { to: string; subject: string }[], track: [] as Record<string, unknown>[] }));
vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@cr17i.test';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.ENGINE_EMAILS = 'false';
  process.env.ACCOUNT_EMAILS = 'false';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => {
  const real = await orig<typeof import('../src/lib/mailer')>();
  return { ...real, sendMail: vi.fn(async (m: { to: string; subject: string }) => (sa.mails.push({ to: m.to, subject: m.subject }), true)) };
});
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (body: Record<string, unknown>) => (sa.track.push(body), { ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    deleteRows: vi.fn(async () => true),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { syncCosts, pulseShares, pulseCharged } = await import('../src/services/admin/costSync');
const { addCreditEntry, creditBalance } = await import('../src/services/admin/credits');
const billing = await import('../src/services/billing');
const { execRows } = await import('../src/services/admin/sqlRows');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
let boss: InstanceType<typeof Client>;
const DAY = 86_400_000;
const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
const verify = (email: string) => db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
async function company(email: string, name: string) {
  const u = await signUp(app, email);
  await verify(email);
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ createdAt: new Date(Date.now() - 40 * DAY) }).where(eq(schema.organizations.id, org.id));
  return { c: u.c, org };
}
const orgRow = async (id: string) => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) }))!;
async function trackedSite(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db.insert(schema.sites).values({ orgId, domain, country: 'United States', verificationToken: 't', verifiedAt: new Date(Date.now() - 40 * DAY), trackingStatus: 'active', ...extra }).returning();
  billing.invalidateForecast(orgId);
  return s;
}
const engineRow = (o: { id: string; key: string; mode: string; usd: number; domain?: string; min?: number }) => ({
  run_id: o.id, key: o.key, mode: o.mode, status: 'done', domain: o.domain ?? '', ai_usd: 0, dfs_usd: o.usd, measured_usd: o.usd, estimated_usd: 0,
  settled_at: new Date(Date.now() - (o.min ?? 5) * 60_000).toISOString(), created_at: new Date(Date.now() - ((o.min ?? 5) + 2) * 60_000).toISOString(),
});

beforeAll(async () => {
  app = await buildApp();
  const b = await signUp(app, 'boss@cr17i.test', 'Boss');
  await verify('boss@cr17i.test');
  boss = b.c;
  await db.update(schema.platformSettings).set({ creditsSince: new Date(0) });
});
afterAll(async () => {
  await app.close();
});

describe('F7: one "credits used" figure', () => {
  it('creditUsage is the ledger\'s sum; the Credits page, its breakdown, the Pipeline summary and the admin book all equal it', async () => {
    const { c, org } = await company('usage@cr17i.test', 'Usage Co');
    await trackedSite(org.id, 'usage.test');
    // autopilot work, an on-demand run with a re-price, a returned run, and one of our team's Trial runs (KI, no app run)
    const at = new Date(Date.now() - 60_000);
    const e = (credits: number, ref: Record<string, unknown>, key: string) => addCreditEntry(db, { orgId: org.id, kind: 'usage', credits, ref, refKey: key, at });
    await e(-12.5, { mode: 'ai_visibility', domain: 'usage.test', origin: 'autopilot', engineRunId: '1' }, 'u1');
    await e(-54.2, { mode: 'keyword', domain: 'usage.test', origin: 'autopilot', engineRunId: '2' }, 'u2');
    await e(-61.4, { mode: 'keyword', domain: 'usage.test', origin: 'on_demand', runId: '00000000-0000-4000-8000-000000000001' }, 'u3');
    await e(1.4, { mode: null, origin: 'on_demand', runId: '00000000-0000-4000-8000-000000000001' }, 'u4');
    await e(-26, { mode: 'keyword_research', domain: 'usage.test', origin: 'on_demand', runId: null, engineRunId: '9' }, 'u5');
    const since = billing.monthStartUtc();
    const u = await billing.creditUsage(db, org.id, { from: since });
    // the ledger itself
    const [raw] = await execRows<{ used: number }>(db, sql`select (-sum(credits))::float as used from credit_ledger where org_id = ${org.id}::uuid and kind = 'usage' and created_at >= ${since.toISOString()}::timestamptz`);
    expect(u.total).toBeCloseTo(Number(raw.used), 2);
    expect(u.total).toBeCloseTo(152.7, 2);
    expect(u.byFeature.reduce((t, f) => t + f.credits, 0)).toBeCloseTo(u.total, 2);
    expect(u.ourTests).toBe(26);
    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b.usage.total).toBe(u.total);
    expect(b.month.autopilotUsed + b.month.onDemandUsed).toBeCloseTo(u.total, 2);
    const p = (await c.get(`/api/orgs/${org.id}/sites/${(await db.query.sites.findFirst({ where: eq(schema.sites.domain, 'usage.test') }))!.id}/data/pipeline`)).body;
    expect(p.summary.creditsUsedThisMonth).toBe(u.total);
    const admin = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(admin.credits.book.used).toBeCloseTo(u.total, 2);
    // M2: the client's own pace leaves our test run out; the forecast and both runways are on the page
    expect(b.forecast.onDemandMonthly).toBeCloseTo(60, 1);
    expect(b.runways.withOwn).not.toBeNull();
    expect(b.costPerOutcome.find((x: { kind: string }) => x.kind === 'page')).toMatchObject({ count: 2 });
  });
});

describe('the automatic top-up request', () => {
  it('files ONE request per low episode, tells the admins and the company, and files again only after the balance was ok', async () => {
    sa.mails.length = 0;
    const { c, org } = await company('auto@cr17i.test', 'Auto Co');
    await trackedSite(org.id, 'auto.test');
    expect((await c.put(`/api/orgs/${org.id}/billing/auto-top-up`, { packId: 'nope' })).status).toBe(400);
    const set = await c.put(`/api/orgs/${org.id}/billing/auto-top-up`, { packId: 'standard' });
    expect(set.status).toBe(200);
    expect(set.body.autoTopUp).toMatchObject({ packId: 'standard', credits: 2000, priceUsd: 100, armed: true });
    // a few days of the schedules left: low
    const st = await billing.creditState(db, await orgRow(org.id), { sites: await billing.siteForecasts(org.id, { fresh: true }) });
    await addCreditEntry(db, { orgId: org.id, kind: 'adjust', credits: Math.round((st.forecastMonthly / 30) * 5) - (await creditBalance(db, org.id)), note: 'set' });
    await billing.creditGuardTick(log);
    await billing.creditGuardTick(log);
    await billing.creditGuardTick(log);
    const reqs = () => db.query.creditPurchaseRequests.findMany({ where: eq(schema.creditPurchaseRequests.orgId, org.id) });
    expect(await reqs()).toHaveLength(1);
    expect((await reqs())[0]).toMatchObject({ auto: true, status: 'pending', credits: 2000, priceUsd: 100, requestedByEmail: 'auto@cr17i.test' });
    expect(sa.mails).toContainEqual({ to: 'boss@cr17i.test', subject: expect.stringMatching(/^Credit request \(automatic\): Auto Co asks for 2,000 credits/) });
    expect(sa.mails).toContainEqual({ to: 'auto@cr17i.test', subject: 'We asked for 2,000 credits for you · Auto Co' });
    // the customer sees it on the Credits page
    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b.requests[0]).toMatchObject({ auto: true, status: 'pending' });
    expect(b.autoTopUp).toMatchObject({ armed: false });
    // the admin confirms it with one click (the pack asked for): ok again, armed again; low again later: one new request
    const r0 = (await reqs())[0];
    expect((await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'grant', credits: 2000, paidUsd: 100, requestId: r0.id, expires: 'pack', notify: false })).status).toBe(200);
    await billing.creditGuardTick(log);
    expect((await orgRow(org.id)).autoTopUpArmed).toBe(true);
    await addCreditEntry(db, { orgId: org.id, kind: 'adjust', credits: -(await creditBalance(db, org.id)) + 1, note: 'spent' });
    await billing.creditGuardTick(log);
    await billing.creditGuardTick(log);
    expect((await reqs()).filter((r) => r.status === 'pending')).toHaveLength(1);
    expect(await reqs()).toHaveLength(2);
    // switched off: nothing more is ever filed
    expect((await c.put(`/api/orgs/${org.id}/billing/auto-top-up`, { packId: null })).body.autoTopUp).toBeNull();
  });

  it('a request a person already filed covers the episode: nothing automatic on top', async () => {
    const { c, org } = await company('auto2@cr17i.test', 'Auto Two');
    await trackedSite(org.id, 'auto2.test');
    await c.put(`/api/orgs/${org.id}/billing/auto-top-up`, { packId: 'starter' });
    await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'large' });
    await addCreditEntry(db, { orgId: org.id, kind: 'adjust', credits: -(await creditBalance(db, org.id)) + 1, note: 'spent' });
    await billing.creditGuardTick(log);
    const rows = await db.query.creditPurchaseRequests.findMany({ where: eq(schema.creditPurchaseRequests.orgId, org.id) });
    expect(rows.map((r) => [r.packId, r.auto])).toEqual([['large', false]]);
  });
});

describe('a request confirmed with another amount', () => {
  it('the Credits page and the admin list say what was added, not the pack asked for', async () => {
    const { c, org } = await company('half@cr17i.test', 'Half Co');
    const req = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'standard' })).body;
    expect((await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'grant', credits: 1000, paidUsd: 50, requestId: req.id, expires: 'pack', notify: false })).status).toBe(200);
    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b.requests[0]).toMatchObject({ credits: 2000, status: 'fulfilled', granted: { credits: 1000, paidUsd: 50 } });
    const list = (await boss.get('/api/admin/credit-requests?status=all')).body;
    expect(list.find((r: { id: string }) => r.id === req.id)).toMatchObject({ granted: { credits: 1000, paidUsd: 50 } });
  });
});

describe('the daily pulse\'s cost, split per website', () => {
  it('pulseShares: by each website\'s own cost in the run, equal without costs, nothing from another day', () => {
    const row = { run_id: '15308', key: 'schedule:ai_pulse', mode: 'ai_pulse', domain: '', created_at: '2026-11-17T11:30:05.297Z', settled_at: '2026-11-17T11:32:08.002Z' };
    const days = [
      { domain: 'devaicon.com', run_id: 'pulse_20261117_devaicon-com', checked_at: '2026-11-17T11:30:04.207Z', cost_usd: 0.084 },
      { domain: 'techand.ai', run_id: 'pulse_20261117_techand-ai', checked_at: '2026-11-17T11:30:04.207Z', cost_usd: 0.132 },
      { domain: 'techand.ai', run_id: 'pulse_20261116_techand-ai', checked_at: '2026-11-16T11:30:04.207Z', cost_usd: 0.132 },
      { domain: 'techand.ai', run_id: 'ondemand-1', checked_at: '2026-11-17T11:31:00.000Z', cost_usd: 0.5 },
    ];
    const s = pulseShares(row, days);
    expect(s.map((x) => x.domain)).toEqual(['devaicon.com', 'techand.ai']);
    expect(s[0].share).toBeCloseTo(0.084 / 0.216, 6);
    expect(pulseShares(row, days.map((d) => ({ ...d, cost_usd: 0 }))).map((x) => x.share)).toEqual([0.5, 0.5]);
    expect(pulseShares(row, [])).toEqual([]);
    expect([pulseCharged(false), pulseCharged(true), pulseCharged(true, 'all'), pulseCharged(false, 'none')]).toEqual([true, false, true, false]);
  });

  it('a shared execution becomes one cost event per website, tied to it; by default the shares are recorded, not charged', async () => {
    const { org: a } = await company('pa@cr17i.test', 'Pulse A');
    const { org: b } = await company('pb@cr17i.test', 'Pulse B');
    await trackedSite(a.id, 'pulse-a.test');
    await trackedSite(b.id, 'pulse-b.test');
    const row = engineRow({ id: 'p-777', key: 'schedule:ai_pulse', mode: 'ai_pulse', usd: 0.216 });
    // first read without the per-website rows: unattributed as before
    await syncCosts({ readLedger: async () => [row], full: true, readPulseDays: async () => [] });
    expect((await db.query.costEvents.findFirst({ where: eq(schema.costEvents.engineRunId, 'p-777') }))!.orgId).toBeNull();
    const checked = new Date(Date.parse(row.created_at) + 1000).toISOString();
    const days = [
      { domain: 'pulse-a.test', run_id: 'pulse_x_a', checked_at: checked, cost_usd: 0.084 },
      { domain: 'pulse-b.test', run_id: 'pulse_x_b', checked_at: checked, cost_usd: 0.132 },
    ];
    await syncCosts({ readLedger: async () => [row], full: true, readPulseDays: async () => days });
    await syncCosts({ readLedger: async () => [row], full: true, readPulseDays: async () => days }); // once only
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.engineRunId, 'p-777') })).toBeUndefined();
    const ea = (await db.query.costEvents.findFirst({ where: eq(schema.costEvents.engineRunId, 'p-777#pulse-a.test') }))!;
    const eb = (await db.query.costEvents.findFirst({ where: eq(schema.costEvents.engineRunId, 'p-777#pulse-b.test') }))!;
    expect(ea).toMatchObject({ orgId: a.id, origin: 'schedule', mode: 'ai_pulse' });
    expect(eb.orgId).toBe(b.id);
    expect(ea.dataforseoUsd + eb.dataforseoUsd).toBeCloseTo(0.216, 6);
    expect(ea.dataforseoUsd).toBeCloseTo(0.084, 6);
    // PULSE_BILLING 'single_site' (today's behaviour): written to the ledger at 0, "included"
    const led = await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, 'cost:engine:p-777#pulse-a.test') });
    expect(led).toMatchObject({ credits: 0, kind: 'usage' });
    expect(led!.note).toMatch(/^Not charged: the daily AI pulse/);
    // a pulse that covered one website is charged as before
    await syncCosts({ readLedger: async () => [engineRow({ id: 'p-778', key: 'schedule:ai_pulse', mode: 'ai_pulse', usd: 0.084, domain: 'pulse-a.test' })], full: true });
    expect((await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, 'cost:engine:p-778') }))!.credits).toBeCloseTo(-5.04, 2);
  });
});

describe('F8: "Track my site" with an empty list clears it', () => {
  it('keywords, competitors and brand names: an empty list is saved as empty (as the engine stores it)', async () => {
    const { c, org } = await company('kw@cr17i.test', 'Keyword Co');
    const site = await trackedSite(org.id, 'kw.test', { keywords: ['open edx provider'], competitors: ['rival.test'], brandNames: ['KW'] });
    const r = await c.post(`/api/orgs/${org.id}/runs`, { mode: 'track', siteId: site.id, country: 'United States', keywords: [], competitors: [], monitors: { brandNames: [] } });
    expect([200, 201, 202]).toContain(r.status);
    const after = (await db.query.sites.findFirst({ where: eq(schema.sites.id, site.id) }))!;
    expect(after).toMatchObject({ keywords: [], competitors: [], brandNames: [] });
    const r2 = await c.post(`/api/orgs/${org.id}/runs`, { mode: 'track', siteId: site.id, country: 'United States', keywords: ['lms development'], competitors: [], monitors: { brandNames: [] } });
    expect([200, 201, 202]).toContain(r2.status);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, site.id) }))!.keywords).toEqual(['lms development']);
  });
});
