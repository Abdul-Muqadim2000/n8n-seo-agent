import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { autopilotMonthlyUsd, monitorSettingsSchema } from '@seo/shared';

// Credits as customers live with them (app/docs/CREDITS.md), end to end on a real Postgres (PGlite, every migration): lots used
// soonest-expiring first, debt paid down by the next lot, expiry, plan months, the quote held and never exceeded, failed runs free,
// autopilot / on-demand kept apart, credits kept for the schedules, the company's own limits, the guard pausing and resuming the
// schedules, "Buy credits" requests fulfilled by the admin, the Credits page, its activity and CSV, and no dollar figure anywhere.

const sa = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], mails: [] as { to: string; subject: string }[] }));
vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@admin.test';
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
  return { ...real, sendMail: vi.fn(async (m: { to: string; subject: string }) => (sa.mails.push({ to: m.to, subject: m.subject }), true)) };
});
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async () => ({ ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    deleteRows: vi.fn(async () => true),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => (sa.calls.push(b), { ok: true, action: String(b.action), affected: 1, error: null })),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { syncCosts } = await import('../src/services/admin/costSync');
const { addCreditEntry, creditBalance } = await import('../src/services/admin/credits');
const billing = await import('../src/services/billing');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
let boss: InstanceType<typeof Client>;
const DAY = 86_400_000;
const verdict = { mode: 'verdict', keyword: 'crm software', country: 'United States' };
const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
/** the default schedules of one website, in credits a month at $0.05 a credit and 3× */
const DEFAULT_FORECAST = Math.round(autopilotMonthlyUsd(monitorSettingsSchema.parse({}), 0) * 60 * 100) / 100;

const userId = async (email: string) => (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!.id;
const verify = (email: string) => db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
async function company(email: string, name: string) {
  const u = await signUp(app, email);
  const org = (await u.c.post('/api/orgs', { name })).body;
  // the fixtures' money settles minutes ago: the company existed by then (money spent before a company existed is never debited)
  await db.update(schema.organizations).set({ createdAt: new Date(Date.now() - DAY) }).where(eq(schema.organizations.id, org.id));
  return { c: u.c, org, userId: await userId(email) };
}
const orgRow = async (id: string) => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) }))!;
const lots = (orgId: string) => db.query.creditLots.findMany({ where: eq(schema.creditLots.orgId, orgId), orderBy: schema.creditLots.createdAt });
const grant = (orgId: string, body: Record<string, unknown>) => boss.post(`/api/admin/companies/${orgId}/credits`, { kind: 'grant', ...body });
async function trackedSite(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db.insert(schema.sites).values({ orgId, domain, country: 'United States', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active', ...extra }).returning();
  billing.invalidateForecast(orgId);
  return s;
}
/** an engine ledger row settled `min` minutes ago */
const engineRow = (o: { id: string; key: string; mode: string; usd: number; domain?: string; min?: number }) => ({
  run_id: o.id, key: o.key, mode: o.mode, status: 'done', domain: o.domain ?? '', ai_usd: 0, dfs_usd: o.usd, measured_usd: o.usd, estimated_usd: 0,
  settled_at: new Date(Date.now() - (o.min ?? 5) * 60_000).toISOString(), created_at: new Date(Date.now() - ((o.min ?? 5) + 2) * 60_000).toISOString(),
});
const sync = (rows: Record<string, unknown>[]) => syncCosts({ readLedger: async () => rows, full: true });
const callback = (orgId: string, runId: string, requestId: string, exec: string) =>
  db.insert(schema.reports).values({ orgId, runId, stage: 'verdict', status: 'completed', title: 'x', requestId, payload: { request_id: requestId, execution_id: exec, run_ledger: {} } });

beforeAll(async () => {
  app = await buildApp();
  const b = await signUp(app, 'boss@admin.test', 'Boss');
  await verify('boss@admin.test');
  boss = b.c;
  // money settles in these tests right now: count it
  await db.update(schema.platformSettings).set({ creditsSince: new Date(0) });
});
afterAll(async () => {
  await app.close();
});

describe('defaults and the Credits page', () => {
  it('a new company: enforced, 200 welcome credits that expire in 90 days, packs at list price, nothing in dollars of cost', async () => {
    const { c, org } = await company('new@credits.test', 'New Co');
    expect((await orgRow(org.id)).creditsEnforced).toBe(true);
    const [lot] = await lots(org.id);
    expect(lot).toMatchObject({ source: 'signup', credits: 200, remaining: 200 });
    expect(Math.round((lot.expiresAt!.getTime() - Date.now()) / DAY)).toBe(90);
    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b).toMatchObject({ enforced: true, balance: 200, held: 0, available: 200, status: 'ok', creditValueUsd: 0.05, checkout: 'request' });
    expect(b.packs.map((p: { credits: number; priceUsd: number }) => [p.credits, p.priceUsd])).toEqual([[500, 25], [2000, 100], [5000, 250], [20000, 1000]]);
    expect(b.lots[0]).toMatchObject({ source: 'signup', remaining: 200 });
    // no provider cost anywhere on the page: no field named after dollars of cost, no Claude / DataForSEO split
    expect(JSON.stringify(b)).not.toMatch(/claude|dataforseo|costUsd|cost_usd/i);
    // the forms' prices: credits per unit of the engine's figures
    expect((await c.get(`/api/orgs/${org.id}/costs`)).body.creditRate).toBe(60);
  });
});

describe('lots', () => {
  it('a debit uses the soonest-expiring lot first; an expired lot is not used; what no lot covers is debt, paid down by the next lot', async () => {
    const { org } = await company('lots@credits.test', 'Lots Co');
    const id = org.id;
    await db.delete(schema.creditLots).where(eq(schema.creditLots.orgId, id));
    await db.delete(schema.creditLedger).where(eq(schema.creditLedger.orgId, id));
    await addCreditEntry(db, { orgId: id, kind: 'grant', credits: 100, note: 'never', lot: { source: 'grant', expiresAt: null } });
    await addCreditEntry(db, { orgId: id, kind: 'grant', credits: 50, note: 'soon', lot: { source: 'pack', expiresAt: new Date(Date.now() + 10 * DAY) } });
    await addCreditEntry(db, { orgId: id, kind: 'grant', credits: 30, note: 'later', lot: { source: 'pack', expiresAt: new Date(Date.now() + 100 * DAY) } });
    const use = await addCreditEntry(db, { orgId: id, kind: 'usage', credits: -70, note: 'used', ref: { origin: 'on_demand' } });
    const l = await lots(id);
    expect(l.map((x) => [x.note, x.remaining])).toEqual([['never', 100], ['soon', 0], ['later', 10]]);
    const stored = await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.id, use!.id) });
    expect((stored!.ref as { lots: { credits: number }[] }).lots.map((x) => x.credits)).toEqual([50, 20]);

    // the "later" lot expires: its 10 credits go, once
    await db.update(schema.creditLots).set({ expiresAt: new Date(Date.now() - 1000) }).where(and(eq(schema.creditLots.orgId, id), eq(schema.creditLots.note, 'later')));
    expect(await billing.expireLots()).toBeGreaterThanOrEqual(1);
    expect(await billing.expireLots()).toBe(0);
    expect(await creditBalance(db, id)).toBe(100);
    const expired = await db.query.creditLedger.findFirst({ where: and(eq(schema.creditLedger.orgId, id), eq(schema.creditLedger.kind, 'expire')) });
    expect(expired).toMatchObject({ credits: -10 });

    // 130 used against 100 left: 30 of debt; the next grant of 50 pays it and keeps 20
    await addCreditEntry(db, { orgId: id, kind: 'usage', credits: -130, note: 'big', ref: { origin: 'autopilot' } });
    expect(await creditBalance(db, id)).toBe(-30);
    await addCreditEntry(db, { orgId: id, kind: 'grant', credits: 50, note: 'top-up', lot: { source: 'pack', expiresAt: null } });
    const top = (await lots(id)).find((x) => x.note === 'top-up')!;
    expect(top.remaining).toBe(20);
    expect(await creditBalance(db, id)).toBe(20);
    const sumRemaining = (await lots(id)).reduce((t, x) => t + x.remaining, 0);
    expect(sumRemaining).toBe(20); // balance = Σ remaining − debt, debt 0
  });

  it('plan credits: granted once a month, lasting to the end of next month (one rollover)', async () => {
    const { org } = await company('plan@credits.test', 'Plan Co');
    const r = await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 1500 });
    expect(r.body.planMonthlyCredits).toBe(1500);
    const plan = (await lots(org.id)).find((x) => x.source === 'plan')!;
    expect(plan.credits).toBe(1500);
    const now = new Date();
    expect(plan.expiresAt!.toISOString().slice(0, 10)).toBe(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1) - 1).toISOString().slice(0, 10));
    expect(await billing.grantPlanCredits()).toBe(0); // not twice in a month
    // next month: granted again
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 2));
    expect(await billing.grantPlanCredits(next)).toBeGreaterThanOrEqual(1);
    expect((await lots(org.id)).filter((x) => x.source === 'plan')).toHaveLength(2);
    expect((await (await signUp(app, 'x@plan.test')).c.get(`/api/orgs/${org.id}/billing`)).status).toBe(404); // not a member
  });
});

describe('quotes, holds and what a run is charged', () => {
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    const a = await company('quote@credits.test', 'Quote Co');
    ids.org = a.org.id;
    Object.assign(ids, { user: a.userId });
    (globalThis as { qc?: unknown }).qc = a.c;
  });
  const c = () => (globalThis as unknown as { qc: InstanceType<typeof Client> }).qc;

  it('a run is quoted in whole credits, held while it runs, and charged what it used, never more than the quote', async () => {
    const r = await c().post(`/api/orgs/${ids.org}/runs`, verdict);
    expect(r.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.orgId, ids.org) }))!;
    expect(run.quotedCredits).toBe(12); // a verdict reserves $0.20 -> 12 credits
    expect((await c().get(`/api/orgs/${ids.org}/billing`)).body).toMatchObject({ held: 12, available: 188 });
    // the engine settles it at $0.50, 30 credits, but it was quoted 12: 12 are charged, 18 absorbed
    await db.update(schema.runs).set({ status: 'completed', completedAt: new Date() }).where(eq(schema.runs.id, run.id));
    await callback(ids.org, run.id, run.requestId!, 'q-e1');
    await sync([engineRow({ id: 'q-e1', key: `app:${ids.org}`, mode: 'verdict', usd: 0.5 })]);
    const debit = (await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, 'cost:engine:q-e1') }))!;
    expect(debit.credits).toBe(-12);
    expect(debit.ref).toMatchObject({ origin: 'on_demand', runId: run.id, absorbed: 18 });
    const b = (await c().get(`/api/orgs/${ids.org}/billing`)).body;
    expect(b).toMatchObject({ held: 0, balance: 188 });
    expect(b.month.onDemandUsed).toBe(12);
    expect(b.byFeature).toEqual([expect.objectContaining({ label: 'Keyword verdict', origin: 'on_demand', credits: 12, runs: 1 })]);
  });

  it('a cheaper run is charged exactly 3× what it cost; a failed run is not charged, and credits taken before it failed come back once', async () => {
    const r = await c().post(`/api/orgs/${ids.org}/runs`, verdict);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.run?.id ?? r.body.id) })) ?? (await db.query.runs.findMany({ where: eq(schema.runs.orgId, ids.org) })).pop()!;
    await db.update(schema.runs).set({ status: 'completed', completedAt: new Date() }).where(eq(schema.runs.id, run.id));
    await callback(ids.org, run.id, run.requestId!, 'q-e2');
    await sync([engineRow({ id: 'q-e2', key: `app:${ids.org}`, mode: 'verdict', usd: 0.1 })]);
    expect((await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, 'cost:engine:q-e2') }))!.credits).toBe(-6);
    // the run turns out failed: its 6 credits come back, once, however often the sync runs
    await db.update(schema.runs).set({ status: 'failed' }).where(eq(schema.runs.id, run.id));
    await sync([]);
    await sync([]);
    const back = await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.refKey, `failed:${run.id}`) });
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ kind: 'usage', credits: 6, note: 'Returned: the run failed' });
    // a later event of the failed run is recorded at 0
    await sync([engineRow({ id: 'q-e3', key: `parent:q-e2`, mode: 'verdict', usd: 0.2 })]);
    const later = (await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, 'cost:engine:q-e3') }))!;
    expect(Math.abs(later.credits)).toBe(0);
    expect(later.note).toMatch(/^Not charged: the run failed/);
  });

  it('a schedule\'s work is autopilot; the month splits them; the activity names each and the CSV carries it', async () => {
    await trackedSite(ids.org, 'quote.test');
    await sync([engineRow({ id: 'q-s1', key: 'schedule:ai_pulse', mode: 'ai_pulse', usd: 0.05, domain: 'quote.test' })]);
    const b = (await c().get(`/api/orgs/${ids.org}/billing`)).body;
    expect(b.month.autopilotUsed).toBe(3);
    expect(b.sites).toEqual([expect.objectContaining({ domain: 'quote.test', usedThisMonth: 3, forecastMonthly: DEFAULT_FORECAST })]);
    expect(b.month.autopilotForecast).toBe(DEFAULT_FORECAST);
    const act = (await c().get(`/api/orgs/${ids.org}/billing/activity?origin=autopilot`)).body;
    expect(act.rows[0]).toMatchObject({ kind: 'usage', credits: -3, origin: 'autopilot', title: 'Daily AI pulse · quote.test' });
    const all = (await c().get(`/api/orgs/${ids.org}/billing/activity`)).body.rows;
    expect(all.map((x: { kind: string }) => x.kind)).toEqual(expect.arrayContaining(['usage', 'refund', 'grant']));
    // the CSV is an owner's / admin's: the owner gets it, a viewer would not
    const csv = await c().get(`/api/orgs/${ids.org}/billing/activity.csv`);
    expect(csv.status).toBe(200);
    expect(csv.text.split('\n')[0]).toBe('date,type,what,website,source,credits,balance_after');
    expect(csv.text).toContain('Daily AI pulse · quote.test');
    expect(csv.text).not.toMatch(/\$/);
  });
});

describe('the credits kept for the schedules, and the company\'s own limits', () => {
  it('on-demand work cannot use what the schedules still need this month; switching that off lets it', async () => {
    const { c, org } = await company('reserve@credits.test', 'Reserve Co');
    await trackedSite(org.id, 'reserve.test');
    const st = await billing.creditState(db, await orgRow(org.id));
    expect(st.forecastMonthly).toBe(DEFAULT_FORECAST);
    expect(st.reserved).toBeGreaterThan(0);
    // leave on-demand exactly 6 credits beyond the reserve: a 12-credit verdict is refused for the reserve, not the balance
    const target = Math.ceil(st.reserved) + 6;
    await addCreditEntry(db, { orgId: org.id, kind: 'adjust', credits: target - st.balance, note: 'set' });
    const r = await c.post(`/api/orgs/${org.id}/runs`, verdict);
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ code: 'credits', creditsNeeded: 12, reason: 'reserve' });
    expect(r.body.error).toMatch(/kept for your websites' automatic work/);
    expect(r.body.error).not.toMatch(/\$/);
    // a viewer / admin cannot change the limits; the owner can
    expect((await c.put(`/api/orgs/${org.id}/billing/limits`, { reserveForAutopilot: false })).status).toBe(200);
    expect((await c.post(`/api/orgs/${org.id}/runs`, verdict)).status).toBe(200);
  });

  it('the on-demand monthly limit holds even when credits are not enforced', async () => {
    const { c, org } = await company('limit@credits.test', 'Limit Co');
    await boss.patch(`/api/admin/companies/${org.id}`, { creditsEnforced: false });
    expect((await c.put(`/api/orgs/${org.id}/billing/limits`, { onDemandMonthly: 20, reserveForAutopilot: true })).body).toMatchObject({ onDemandMonthly: 20 });
    expect((await c.post(`/api/orgs/${org.id}/runs`, verdict)).status).toBe(200); // 12 held of 20
    const r = await c.post(`/api/orgs/${org.id}/runs`, verdict);
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ reason: 'on_demand_limit' });
    expect(r.body.error).toMatch(/on-demand limit of 20 credits/);
    expect((await c.put(`/api/orgs/${org.id}/billing/limits`, { onDemandMonthly: -1 })).status).toBe(400);
  });
});

describe('the guard', () => {
  it('out of credits: pauses the schedules (once), tells the owners, and resumes them after a top-up, never what a person paused', async () => {
    sa.calls.length = 0;
    sa.mails.length = 0;
    const { org } = await company('guard@credits.test', 'Guard Co');
    const auto = await trackedSite(org.id, 'guard.test');
    const manual = await trackedSite(org.id, 'manual.test', { trackingStatus: 'paused' });
    await addCreditEntry(db, { orgId: org.id, kind: 'usage', credits: -250, note: 'big', ref: { origin: 'autopilot' } });
    const mine = () => sa.calls.filter((x) => x.domain === 'guard.test' || x.domain === 'manual.test');
    const mail = () => sa.mails.filter((m) => m.to === 'guard@credits.test' && !/^Confirm/.test(m.subject)).map((m) => m.subject);
    await billing.creditGuardTick(log);
    expect(mine()).toEqual([expect.objectContaining({ action: 'pause', domain: 'guard.test' })]);
    const s1 = (await db.query.sites.findFirst({ where: eq(schema.sites.id, auto.id) }))!;
    expect(s1).toMatchObject({ trackingStatus: 'paused', creditsPausedReason: 'balance' });
    expect(s1.creditsPausedAt).not.toBeNull();
    expect(mail()).toEqual([expect.stringMatching(/^Automatic work is paused: out of credits/)]);
    expect((await orgRow(org.id)).creditAlertLevel).toBe('paused');
    // a second pass changes nothing and says nothing again
    await billing.creditGuardTick(log);
    expect(mine()).toHaveLength(1);
    expect(mail()).toHaveLength(1);
    // credits added: resumed, the owners told, the person's own pause left alone
    await grant(org.id, { credits: 2000, paidUsd: 100 });
    await billing.creditGuardTick(log);
    expect(mine().filter((x) => x.action === 'resume').map((x) => x.domain)).toEqual(['guard.test']);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, auto.id) }))!).toMatchObject({ trackingStatus: 'active', creditsPausedAt: null });
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, manual.id) }))!.trackingStatus).toBe('paused');
    expect(mail()).toContainEqual(expect.stringMatching(/^Automatic work has resumed/));
  });

  it('the autopilot limit pauses the schedules for the rest of the month; raising it resumes them', async () => {
    sa.calls.length = 0;
    const { c, org } = await company('aplimit@credits.test', 'Autopilot Limit Co');
    const site = await trackedSite(org.id, 'aplimit.test');
    await sync([engineRow({ id: 'ap-1', key: 'schedule:ai_pulse', mode: 'ai_pulse', usd: 0.5, domain: 'aplimit.test' })]); // 30 credits
    await c.put(`/api/orgs/${org.id}/billing/limits`, { autopilotMonthly: 25 });
    await billing.creditGuardTick(log);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, site.id) }))!).toMatchObject({ trackingStatus: 'paused', creditsPausedReason: 'autopilot_limit' });
    await c.put(`/api/orgs/${org.id}/billing/limits`, { autopilotMonthly: 100 });
    await billing.creditGuardTick(log);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, site.id) }))!.trackingStatus).toBe('active');
  });

  it('a low balance is announced once, with the days it lasts', async () => {
    sa.mails.length = 0;
    const { org } = await company('low@credits.test', 'Low Co');
    await trackedSite(org.id, 'low.test');
    // about 5 days of the schedules left
    const daily = DEFAULT_FORECAST / 30;
    const bal = await creditBalance(db, org.id);
    await addCreditEntry(db, { orgId: org.id, kind: 'adjust', credits: Math.round(daily * 5) - bal, note: 'set' });
    await billing.creditGuardTick(log);
    expect((await orgRow(org.id)).creditAlertLevel).toBe('low');
    const low = () => sa.mails.filter((m) => m.to === 'low@credits.test' && /within a week/.test(m.subject));
    expect(low()).toHaveLength(1);
    await billing.creditGuardTick(log);
    expect(low()).toHaveLength(1);
  });
});

describe('Buy credits: the request, the admin\'s confirmation', () => {
  it('owners and admins ask for a pack; the platform admins are told; fulfilling it adds a 12-month pack and records the payment', async () => {
    sa.mails.length = 0;
    const { c, org } = await company('buy@credits.test', 'Buy Co');
    expect((await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'nope' })).status).toBe(400);
    const req = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'standard', note: 'PO 4411' })).body;
    expect(req).toMatchObject({ packId: 'standard', credits: 2000, priceUsd: 100, status: 'pending', requestedBy: 'buy@credits.test' });
    expect(sa.mails).toContainEqual({ to: 'boss@admin.test', subject: expect.stringMatching(/^Credit request: Buy Co asks for 2,000 credits \(\$100\.00\)/) });
    const list = (await boss.get('/api/admin/credit-requests')).body;
    expect(list).toContainEqual(expect.objectContaining({ id: req.id, orgName: 'Buy Co' }));
    const g = await grant(org.id, { credits: 2000, paidUsd: 100, requestId: req.id });
    expect(g.status).toBe(200);
    const pack = (await lots(org.id)).find((x) => x.source === 'pack')!;
    expect(pack.credits).toBe(2000);
    expect(Math.round((pack.expiresAt!.getTime() - Date.now()) / DAY)).toBeGreaterThan(360);
    expect((await db.query.creditPurchaseRequests.findFirst({ where: eq(schema.creditPurchaseRequests.id, req.id) }))!.status).toBe('fulfilled');
    expect((await grant(org.id, { credits: 2000, paidUsd: 100, requestId: req.id })).status).toBe(409); // never twice
    expect((await c.del(`/api/orgs/${org.id}/billing/requests/${req.id}`)).status).toBe(404); // not waiting any more
    // a member cannot ask; a waiting one can be cancelled by the customer
    const r2 = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'starter' })).body;
    expect((await c.del(`/api/orgs/${org.id}/billing/requests/${r2.id}`)).body.status).toBe('cancelled');
    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b.balance).toBe(2200);
    expect(b.requests.map((x: { status: string }) => x.status)).toEqual(['cancelled', 'fulfilled']);
    const row = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(row.money.revenueUsd).toBe(100);
    // the admin's credit book: 2,000 bought for $100, 200 welcome credits given free, 2,200 left, owed at list $110, costing us ~$36.67
    expect(row.credits.book).toMatchObject({
      bought: 2000, boughtUsd: 100, free: 200, freeListUsd: 10, used: 0, remaining: 2200, remainingListUsd: 110, creditValueUsd: 0.05, markup: 3,
    });
    expect(row.credits.book.remainingCostUsd).toBeCloseTo(36.6667, 3);
  });
});

describe('the admin\'s credit book (the Credits / USD switch)', () => {
  it('used credits at list price beside what the work really cost us; autopilot / on-demand; absorbed; the platform total adds every company', async () => {
    const { c, org } = await company('book@credits.test', 'Book Co');
    await trackedSite(org.id, 'book.test');
    await c.put(`/api/orgs/${org.id}/billing/limits`, { reserveForAutopilot: false }); // the website's schedules would otherwise keep the welcome credits
    // an on-demand verdict quoted 12, settled at $0.50 (30 credits): 12 charged, 18 absorbed; a schedule at $0.10: 6 credits
    const r = await c.post(`/api/orgs/${org.id}/runs`, verdict);
    expect(r.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.orgId, org.id) }))!;
    await db.update(schema.runs).set({ status: 'completed', completedAt: new Date() }).where(eq(schema.runs.id, run.id));
    await callback(org.id, run.id, run.requestId!, 'b-e1');
    await sync([engineRow({ id: 'b-e1', key: `app:${org.id}`, mode: 'verdict', usd: 0.5 }), engineRow({ id: 'b-s1', key: 'schedule:ai_pulse', mode: 'ai_pulse', usd: 0.1, domain: 'book.test' })]);
    const b = (await boss.get(`/api/admin/companies/${org.id}`)).body.credits.book;
    expect(b).toMatchObject({ used: 18, usedOnDemand: 12, usedAutopilot: 6, absorbed: 18, free: 200, bought: 0, boughtUsd: 0, remaining: 182 });
    expect(b.usedListUsd).toBeCloseTo(0.9, 6); // 18 credits at $0.05
    expect(b.usedCostUsd).toBeCloseTo(0.6, 6); // $0.50 + $0.10 of provider cost behind them (the capped part included)
    expect(b.absorbedListUsd).toBeCloseTo(0.9, 6);
    expect(b.remainingListUsd).toBeCloseTo(9.1, 6);
    const o = (await boss.get('/api/admin/overview')).body;
    const companies = (await boss.get('/api/admin/companies')).body as { credits: { book: { remaining: number; bought: number } } }[];
    expect(o.credits.book.remaining).toBeCloseTo(companies.reduce((t, x) => t + x.credits.book.remaining, 0), 2);
    expect(o.credits.book.used).toBeCloseTo(companies.reduce((t, x) => t + (x.credits.book as unknown as { used: number }).used, 0), 2);
    // a customer never reads the book
    expect((await c.get(`/api/admin/companies/${org.id}`)).status).toBe(403);
  });
});

describe('companies from before credits are brought onto them (once, carefully)', () => {
  it('welcome credits and enforcement as a new company gets them; never twice; a company that would start at or below zero, a client workspace or a disabled one is left counted only', async () => {
    const legacy = { creditValueUsd: 0.05, markup: 3, signupCredits: 0, enforceForNewCompanies: false };
    const now = { ...legacy, signupCredits: 200, enforceForNewCompanies: true };
    // before credits: companies got nothing and were not enforced
    await db.update(schema.platformSettings).set({ ...legacy, creditsAlignedAt: null });
    const a = await company('old-a@align.test', 'Old A');
    const b = await company('old-b@align.test', 'Old B');
    const d = await company('old-d@align.test', 'Old D');
    await db.update(schema.organizations).set({ disabled: true }).where(eq(schema.organizations.id, d.org.id));
    const [client] = await db.insert(schema.organizations).values({ name: 'Old Client', slug: 'old-client-align', hookToken: 'hook-old-client-align', monthlyBudgetUsd: 25, kind: 'client', parentOrgId: a.org.id }).returning();
    // B used 500 credits of work before credits were enforced
    await addCreditEntry(db, { orgId: b.org.id, kind: 'usage', credits: -500, note: 'old usage', ref: { origin: 'autopilot' } });
    for (const o of [a.org.id, b.org.id, d.org.id]) expect((await orgRow(o)).creditsEnforced).toBe(false);
    expect(await lots(a.org.id)).toEqual([]);

    // the deploy: today's settings, then the pass at server start
    await db.update(schema.platformSettings).set(now);
    const r = await billing.alignExistingCompanies(log, { auto: true });
    expect(r.ran).toBe(true);
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    expect(ids(r.granted)).toEqual(expect.arrayContaining([a.org.id, b.org.id]));
    expect(ids(r.granted)).not.toContain(client.id); // a client workspace's credits come from its agency, as for new ones
    expect(ids(r.granted)).not.toContain(d.org.id); // disabled
    expect(ids(r.enforced)).toContain(a.org.id);
    expect(r.leftCountedOnly).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: b.org.id, balance: -300, reason: expect.stringMatching(/would pause its schedules/) }),
        expect.objectContaining({ id: client.id, reason: expect.stringMatching(/client workspace/) }),
        expect.objectContaining({ id: d.org.id }),
      ]),
    );
    // A: 200 welcome credits valid 90 days, enforced; B: its welcome credits paid its debt first, left counted only
    expect((await orgRow(a.org.id)).creditsEnforced).toBe(true);
    const [lotA] = await lots(a.org.id);
    expect(lotA).toMatchObject({ source: 'signup', credits: 200, remaining: 200 });
    expect(Math.round((lotA.expiresAt!.getTime() - Date.now()) / DAY)).toBe(90);
    expect((await orgRow(b.org.id)).creditsEnforced).toBe(false);
    expect(await creditBalance(db, b.org.id)).toBe(-300);
    expect((await lots(b.org.id))[0]).toMatchObject({ credits: 200, remaining: 0 });
    expect((await orgRow(client.id)).creditsEnforced).toBe(false);
    // companies that were already on credits keep what they had (their welcome credits are never granted again)
    expect(ids(r.granted)).not.toContain((await db.query.organizations.findFirst({ where: eq(schema.organizations.name, 'New Co') }))!.id);
    // recorded for the admin
    const logged = await db.query.adminAudit.findFirst({ where: eq(schema.adminAudit.action, 'credits.aligned') });
    expect(logged).toMatchObject({ actorEmail: 'system', targetType: 'platform' });

    // once: the next server start does nothing; an admin's re-run grants and changes nothing twice
    expect((await billing.alignExistingCompanies(log, { auto: true })).ran).toBe(false);
    const again = (await boss.post('/api/admin/credits/align')).body;
    expect(again).toMatchObject({ ran: true, granted: [], enforced: [] });
    expect((await lots(a.org.id)).filter((l) => l.source === 'signup')).toHaveLength(1);
    expect((await signUp(app, 'nosy@align.test')).c ? (await (await signUp(app, 'nosy2@align.test')).c.post('/api/admin/credits/align')).status : 0).toBe(403);
  });
});
