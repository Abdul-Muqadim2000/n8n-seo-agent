import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The platform admin panel end to end on a real Postgres (PGlite, every migration): the guard, credits, the cost sync's attribution and
// no-double-count rule, enforcement, suspension, people and companies, the runs page, the CSV and the overview's totals.

vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@admin.test';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.ANTHROPIC_ADMIN_API_KEY = '';
  process.env.SEO_DATAFORSEO_LOGIN = '';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
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
    siteAdmin: vi.fn(async () => ({ ok: true, action: 'delete', affected: 0, error: null })),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { syncCosts } = await import('../src/services/admin/costSync');
const { reserveCheck } = await import('../src/services/keywordCheckStore');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
let boss: InstanceType<typeof Client>;
let bossId = '';
const PW = 'correct horse battery staple';

const userId = async (email: string) => (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!.id;
const verify = (email: string) => db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
async function company(email: string, name: string) {
  const u = await signUp(app, email);
  const org = (await u.c.post('/api/orgs', { name })).body;
  return { c: u.c, org, userId: await userId(email) };
}
const credits = async (orgId: string) => (await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, orgId) })).reduce((a, e) => a + e.credits, 0);

beforeAll(async () => {
  app = await buildApp();
  const b = await signUp(app, 'boss@admin.test', 'Boss');
  await verify('boss@admin.test');
  boss = b.c;
  bossId = await userId('boss@admin.test');
});
afterAll(async () => {
  await app.close();
});

describe('the guard', () => {
  it('every admin route refuses a signed-in non-admin (403) and an anonymous caller (401)', async () => {
    const u = await signUp(app, 'nosy@user.test');
    await verify('nosy@user.test');
    const id = '00000000-0000-4000-8000-000000000000';
    const routes: [string, string, unknown?][] = [
      ['GET', '/api/admin/overview'],
      ['GET', '/api/admin/companies'],
      ['GET', `/api/admin/companies/${id}`],
      ['PATCH', `/api/admin/companies/${id}`, { disabled: true }],
      ['POST', `/api/admin/companies/${id}/credits`, { kind: 'grant', credits: 10 }],
      ['GET', `/api/admin/companies/${id}/credits`],
      ['DELETE', `/api/admin/companies/${id}`, { confirm: 'x' }],
      ['GET', '/api/admin/users'],
      ['POST', '/api/admin/users', { email: 'a@b.test', name: 'A' }],
      ['PATCH', `/api/admin/users/${id}`, { suspended: true }],
      ['DELETE', `/api/admin/users/${id}`, {}],
      ['POST', `/api/admin/users/${id}/sessions/revoke`],
      ['PUT', `/api/admin/users/${id}/memberships`, { orgId: id, role: 'member' }],
      ['DELETE', `/api/admin/users/${id}/memberships/${id}`],
      ['GET', '/api/admin/runs'],
      ['POST', '/api/admin/costs/sync'],
      ['GET', '/api/admin/settings'],
      ['PUT', '/api/admin/settings', { creditValueUsd: 1, markup: 1, signupCredits: 0, enforceForNewCompanies: false }],
      ['GET', '/api/admin/activity'],
      ['GET', '/api/admin/export/companies.csv'],
    ];
    const anon = new Client(app);
    for (const [m, url, body] of routes) {
      const r = await u.c.req(m, url, body);
      expect(r.status, `${m} ${url}`).toBe(403);
      expect((await anon.req(m, url, body)).status, `anon ${m} ${url}`).toBe(401);
    }
    // an unverified address on the admin list is not an admin
    const fake = await signUp(app, 'BOSS2@admin.test');
    expect((await fake.c.get('/api/admin/overview')).status).toBe(403);
    // the old endpoints still answer the admin
    expect((await boss.get('/api/admin/orgs')).status).toBe(200);
  });
});

describe('settings and credits', () => {
  it('settings: defaults, validation, saved with who changed them, logged', async () => {
    const s = (await boss.get('/api/admin/settings')).body;
    // credits (0015, app/docs/CREDITS.md): $0.05 a credit at 3x, 200 welcome credits, enforced for new companies, four packs at list price
    expect(s).toMatchObject({ creditValueUsd: 0.05, markup: 3, signupCredits: 200, enforceForNewCompanies: true, packExpiryMonths: 12, planRollover: true, signupExpiryDays: 90 });
    expect(s.creditPacks.map((p: { credits: number }) => p.credits)).toEqual([500, 2000, 5000, 20000]);
    // the rest of this file was written against the earlier baseline: $0.10 a credit, no welcome credits, nothing enforced
    expect((await boss.put('/api/admin/settings', { ...s, markup: 0.5 })).status).toBe(400);
    const saved = (await boss.put('/api/admin/settings', { creditValueUsd: 0.1, markup: 3, signupCredits: 0, enforceForNewCompanies: false })).body;
    expect(saved.updatedBy).toBe('boss@admin.test');
  });

  it('grant / adjust / refund: validated, signed, with the running balance and the payment as revenue', async () => {
    const { org } = await company('owner@credits.test', 'Credit Co');
    const url = `/api/admin/companies/${org.id}/credits`;
    expect((await boss.post(url, { kind: 'grant', credits: -5 })).status).toBe(400);
    expect((await boss.post(url, { kind: 'adjust', credits: 0 })).status).toBe(400);
    expect((await boss.post(url, { kind: 'refund', credits: 5, paidUsd: 2 })).status).toBe(400);
    const g = (await boss.post(url, { kind: 'grant', credits: 100, paidUsd: 25, note: 'Starter pack' })).body;
    expect(g).toMatchObject({ kind: 'grant', credits: 100, paidUsd: 25, note: 'Starter pack', actor: 'boss@admin.test', balanceAfter: 100 });
    const a = (await boss.post(url, { kind: 'adjust', credits: -30 })).body;
    expect(a).toMatchObject({ kind: 'adjust', credits: -30, paidUsd: 0, balanceAfter: 70, note: 'Balance corrected' });
    expect((await boss.post(url, { kind: 'refund', credits: 5 })).body.balanceAfter).toBe(75);
    const list = (await boss.get(url)).body;
    expect(list.map((e: { balanceAfter: number }) => e.balanceAfter)).toEqual([75, 70, 100]);
    const row = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(row.credits).toMatchObject({ balance: 75, grantedInPeriod: 100, enforced: false });
    expect(row.money.revenueUsd).toBe(25);
    const acts = (await boss.get('/api/admin/activity')).body.map((x: { action: string }) => x.action);
    expect(acts).toEqual(expect.arrayContaining(['credits.granted', 'credits.adjusted', 'credits.refunded']));
  });

  it('a refund is not negative usage, and list value keeps the credit value of the day each credit was used', async () => {
    const { addCreditEntry } = await import('../src/services/admin/credits');
    const { org } = await company('owner@listvalue.test', 'List Value Co');
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'grant', credits: 100, paidUsd: 10 });
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'refund', credits: 5 });
    let row = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(row.credits.usedInPeriod).toBe(0);
    expect(row.money.listValueUsd).toBe(0);
    // 30 credits used at $0.10 a credit
    await addCreditEntry(db, { orgId: org.id, kind: 'usage', credits: -30, note: 'Used', ref: { creditValueUsd: 0.1 }, refKey: 'cost:test:listvalue' });
    row = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(row.credits.usedInPeriod).toBe(30);
    expect(row.money.listValueUsd).toBe(3);
    const s = (await boss.get('/api/admin/settings')).body;
    await boss.put('/api/admin/settings', { creditValueUsd: 0.05, markup: s.markup, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies });
    row = (await boss.get(`/api/admin/companies/${org.id}`)).body;
    expect(row.money.listValueUsd).toBe(3);
    await boss.put('/api/admin/settings', { creditValueUsd: s.creditValueUsd, markup: s.markup, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies });
  });
});

describe('the cost sync', () => {
  const ids: Record<string, string> = {};
  const T0 = Date.now();
  const ago = (min: number) => new Date(T0 - min * 60_000);
  /** rows the engine has settled again since (the read gives their newest state) */
  const resettled: Record<string, Record<string, unknown>> = {};
  const reads: (string | null)[] = [];
  // the reader the sync is handed: records where each read starts (null = the whole ledger)
  const reader = (rows: () => Record<string, unknown>[]) => async (since: string | null) => {
    reads.push(since);
    return rows();
  };
  const appRun = async (v: { requestId: string; mode: string; cost: number; completedMin: number; status?: string; title?: string }) =>
    (
      await db
        .insert(schema.runs)
        .values({ orgId: ids.org, siteId: ids.site, userId: ids.user, mode: v.mode, title: v.title ?? v.mode, status: v.status ?? 'completed', requestId: v.requestId, input: { mode: v.mode }, actualCostUsd: v.cost, completedAt: ago(v.completedMin), createdAt: ago(v.completedMin + 5) })
        .returning()
    )[0];
  /** a callback stored on the run, naming the engine execution that built it (as every engine callback does) */
  const callback = (runId: string, requestId: string, executionId: string | null, ledger: Record<string, unknown> = {}) =>
    db.insert(schema.reports).values({ orgId: ids.org, runId, stage: 'content', status: 'completed', title: 'x', requestId, payload: { request_id: requestId, ...(executionId ? { execution_id: executionId } : {}), run_ledger: ledger } });
  const debits = async (key: string) => db.query.creditLedger.findMany({ where: eq(schema.creditLedger.refKey, key) });

  beforeAll(async () => {
    const a = await company('owner@costs.test', 'Cost Co');
    ids.org = a.org.id;
    ids.user = a.userId;
    // the company and its website existed well before the fixtures' money was spent
    await db.update(schema.organizations).set({ createdAt: ago(3 * 24 * 60) }).where(eq(schema.organizations.id, a.org.id));
    const [site] = await db.insert(schema.sites).values({ orgId: a.org.id, domain: 'costco.test', country: 'United States', verificationToken: 't', verifiedAt: ago(2 * 24 * 60) }).returning();
    ids.site = site.id;
    // front-door request id fd1 ≠ the engine execution e1 that wrote the ledger row; the callback names e1
    const r1 = await appRun({ requestId: 'fd1', mode: 'keyword', cost: 0.5, completedMin: 120, title: 'Page: crm' });
    ids.r1 = r1.id;
    await callback(r1.id, 'fd1', 'e1', { dataforseo_usd: 0.2, ai_usd: 0.3 });
    // the fixtures settled hours ago; credits are counted from the deploy of 0014 on, so count them from before that
    await db.update(schema.platformSettings).set({ creditsSince: new Date(0) });
  });

  const ledger = () => [
    { run_id: 'e1', key: `app:${ids.org}`, mode: 'keyword', status: 'done', ai_usd: 0.3, dfs_usd: 0.2, measured_usd: 0.2, estimated_usd: 0.3, settled_at: ago(119).toISOString(), created_at: ago(125).toISOString(), dfs_balance: 20, dfs_balance_end: 19.8 },
    { run_id: 'e2', key: 'parent:e1', mode: 'ai_visibility', status: 'done', ai_usd: 0.1, dfs_usd: 0.4, measured_usd: 0.5, estimated_usd: 0, settled_at: ago(118).toISOString() },
    { run_id: 'e3', key: 'schedule:rank_tracker', mode: 'rank_tracker', status: 'done', domain: 'costco.test', ai_usd: 0, dfs_usd: 0.05, measured_usd: 0.05, estimated_usd: 0, settled_at: ago(60).toISOString(), created_at: ago(61).toISOString(), dfs_balance: 19.8, dfs_balance_end: 19.75 },
    { run_id: 'e4', key: 'schedule:ai_pulse', mode: 'ai_pulse', status: 'done', domain: 'nobody.test', ai_usd: 0, dfs_usd: 0.02, measured_usd: 0.02, estimated_usd: 0, settled_at: ago(30).toISOString() },
    { run_id: 'e5', key: `app:${ids.org}`, mode: 'assess', status: 'done', ai_usd: 0.0033, dfs_usd: 0.03, settled_at: ago(20).toISOString() },
    { run_id: 'e6', key: 'schedule:cadence', mode: 'cadence', status: 'reserved', domain: 'costco.test', ai_usd: 1, dfs_usd: 1 },
  ].map((x) => ({ ...x, ...(resettled[x.run_id] ?? {}) }));

  it('ties the engine row to the run through its callback (front-door id ≠ engine id): no second, app-side figure, one debit', async () => {
    const r = await syncCosts({ readLedger: reader(ledger) });
    expect(reads).toEqual([null]); // the first read is a full one
    expect(r).toMatchObject({ ok: true, ledgerReadable: true, ledgerRows: 5, engineEvents: 4, appEvents: 0 });
    const ev = await db.query.costEvents.findMany();
    const by = (k: string) => ev.find((e) => e.eventKey === k)!;
    expect(by('engine:e1')).toMatchObject({ orgId: ids.org, runId: ids.r1, siteId: ids.site, userId: ids.user, origin: 'app', claudeUsd: 0.3, dataforseoUsd: 0.2, certainty: 'partly estimated' });
    expect(by('engine:e2')).toMatchObject({ orgId: ids.org, runId: ids.r1, origin: 'app' });
    expect(by('engine:e3')).toMatchObject({ orgId: ids.org, runId: null, siteId: ids.site, origin: 'schedule' });
    expect(by('engine:e4')).toMatchObject({ orgId: null, origin: 'schedule' });
    expect(ev.some((e) => e.eventKey === 'engine:e5' || e.eventKey === 'engine:e6' || e.eventKey === `run:${ids.r1}`)).toBe(false);
    // one usage debit per event of the company: 0.5 -> 15 credits, 0.5 -> 15, 0.05 -> 1.5
    expect(await credits(ids.org)).toBeCloseTo(-31.5, 6);
    expect((await debits('cost:engine:e1'))[0]).toMatchObject({ orgName: 'Cost Co', credits: -15 });
  });

  it('running it again changes nothing, and reads only what settled since the last read', async () => {
    const newest = ledger().filter((x) => x.status === 'done').map((x) => x.settled_at!).sort().pop()!;
    expect((await db.query.platformSettings.findFirst())!.ledgerWatermark).toBe(newest);
    const r = await syncCosts({ readLedger: reader(ledger) });
    expect(r).toMatchObject({ engineEvents: 0, appEvents: 0, debits: 0 });
    // incremental: from the newest settled_at read, minus a day
    expect(reads[1]).toBe(new Date(new Date(newest).getTime() - 86_400_000).toISOString());
    expect(await credits(ids.org)).toBeCloseTo(-31.5, 6);
    const [a, b] = await Promise.all([syncCosts({ readLedger: reader(ledger) }), syncCosts({ readLedger: reader(ledger) })]);
    expect(a.debits + b.debits).toBe(0);
    expect((await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, ids.org) })).length).toBe(3);
    await syncCosts({ readLedger: reader(ledger), full: true });
    expect(reads[reads.length - 1]).toBeNull();
  });

  it('an engine row stored before its run\'s callback arrived is linked to the run later (back-fill), never counted twice', async () => {
    const r3 = await appRun({ requestId: 'fd8', mode: 'audit', cost: 0.2, completedMin: 90, status: 'running' });
    const early = [...ledger(), { run_id: 'e8', key: `app:${ids.org}`, mode: 'audit', status: 'done', ai_usd: 0, dfs_usd: 0.2, measured_usd: 0.2, estimated_usd: 0, settled_at: ago(89).toISOString(), created_at: ago(95).toISOString() }];
    await syncCosts({ readLedger: reader(() => early) });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:e8') })).toMatchObject({ orgId: ids.org, runId: null });
    // now the callback names e8 and the run is done; this read does not even carry e8 any more
    await callback(r3.id, 'fd8', 'e8', { dataforseo_usd: 0.2, ai_usd: 0 });
    await db.update(schema.runs).set({ status: 'completed' }).where(eq(schema.runs.id, r3.id));
    const r = await syncCosts({ readLedger: reader(ledger) });
    expect(r.appEvents).toBe(0);
    expect((await db.query.costEvents.findMany({ where: eq(schema.costEvents.runId, r3.id) })).map((e) => e.eventKey)).toEqual(['engine:e8']);
    expect(await debits(`cost:run:${r3.id}`)).toEqual([]);
    expect((await debits('cost:engine:e8')).length).toBe(1);
  });

  it('an old engine whose callbacks name no execution: the run takes the unlinked engine row of its window, not its own figure', async () => {
    const r4 = await appRun({ requestId: 'fd9', mode: 'verdict', cost: 0.2, completedMin: 100 });
    await callback(r4.id, 'fd9', null, { dataforseo_usd: 0.04, ai_usd: 0.16 });
    const rows = () => [...ledger(), { run_id: 'e9', key: `app:${ids.org}`, mode: 'verdict', status: 'done', ai_usd: 0.16, dfs_usd: 0.04, settled_at: ago(100).toISOString(), created_at: ago(104).toISOString() }];
    const r = await syncCosts({ readLedger: reader(rows) });
    expect(r.appEvents).toBe(0);
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:e9') })).toMatchObject({ runId: r4.id });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, `run:${r4.id}`) })).toBeUndefined();
  });

  it('the ledger unreadable: an app run counts from its own figure; once its engine row arrives the engine figure replaces it', async () => {
    const r2 = await appRun({ requestId: 'fd7', mode: 'verdict', cost: 0.4, completedMin: 10, title: 'Verdict: crm' });
    await callback(r2.id, 'fd7', 'e7', { dataforseo_usd: 0.1, ai_usd: 0.3 });
    const before = await credits(ids.org);
    const off = await syncCosts({ readLedger: async () => Promise.reject(new Error('n8n is not reachable')) });
    expect(off.ledgerReadable).toBe(false);
    expect(off.appEvents).toBe(1);
    const app_ = await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, `run:${r2.id}`) });
    expect(app_).toMatchObject({ source: 'app', claudeUsd: 0.3, dataforseoUsd: 0.1, certainty: 'measured', origin: 'app' });
    expect(await credits(ids.org)).toBeCloseTo(before - 12, 6);
    const over = (await boss.get('/api/admin/overview')).body;
    expect(over.sources.engineLedger.ok).toBe(false);
    expect(over.sources.engineLedger.note).toMatch(/could not be read/);

    const on = await syncCosts({ readLedger: reader(() => [...ledger(), { run_id: 'e7', key: `app:${ids.org}`, mode: 'verdict', status: 'done', ai_usd: 0.35, dfs_usd: 0.1, measured_usd: 0.1, estimated_usd: 0.35, settled_at: ago(9).toISOString() }]) });
    expect(on).toMatchObject({ engineEvents: 1, superseded: 1 });
    const forRun = await db.query.costEvents.findMany({ where: eq(schema.costEvents.runId, r2.id) });
    expect(forRun.map((e) => e.source)).toEqual(['engine']);
    // the app figure's 12 credits given back (dated at the original event), the engine's 13.5 used: counted once
    expect(await credits(ids.org)).toBeCloseTo(before - 13.5, 6);
    const back = (await debits(`reprice:run:${r2.id}`))[0];
    expect(back.credits).toBe(12);
    expect(back.createdAt.getTime()).toBe(app_!.occurredAt.getTime());
    const run = (await boss.get(`/api/admin/runs?orgId=${ids.org}&status=done&origin=app`)).body.rows.find((x: { id: string }) => x.id === r2.id);
    expect(run.cost).toMatchObject({ claudeUsd: 0.35, dataforseoUsd: 0.1, totalUsd: 0.45 });
    expect(run.credits).toBe(13.5);
  });

  it('a row the engine settles again with another figure: the event follows it and the difference is debited once', async () => {
    resettled.e3 = { dfs_usd: 0.15, measured_usd: 0.15, settled_at: ago(5).toISOString() };
    const fixed = ledger();
    await syncCosts({ readLedger: async () => fixed });
    await syncCosts({ readLedger: async () => fixed });
    // an older reading of the same row (a read that overlaps) never takes it back
    await syncCosts({ readLedger: async () => fixed.map((x) => (x.run_id === 'e3' ? { ...x, dfs_usd: 0.05, settled_at: ago(60).toISOString() } : x)) });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:e3') })).toMatchObject({ dataforseoUsd: 0.15 });
    const all = (await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, ids.org) })).filter((e) => e.refKey?.startsWith('cost:engine:e3'));
    expect(all.map((e) => e.credits).sort((a, b) => a - b)).toEqual([-3, -1.5]);
    // and the settings changing later does not re-price anything already debited
    await db.update(schema.platformSettings).set({ markup: 5 });
    expect((await syncCosts({ readLedger: async () => fixed })).debits).toBe(0);
    await db.update(schema.platformSettings).set({ markup: 3 });
    const detail = (await boss.get(`/api/admin/companies/${ids.org}?period=all`)).body;
    expect(detail.byMode.find((m: { mode: string }) => m.mode === 'rank_tracker').credits).toBe(4.5);
  });

  it('a keyword check counts once, from the app (its engine row is left out)', async () => {
    const [k] = await db.insert(schema.keywordChecks).values({ orgId: ids.org, siteId: ids.site, userId: ids.user, keyword: 'crm', country: 'US', status: 'done', costUsd: 0.03, result: { cost_usd: 0.03 } }).returning();
    const r = await syncCosts({ readLedger: reader(ledger) });
    expect(r.keywordEvents).toBe(1);
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, `kc:${k.id}`) })).toMatchObject({ claudeUsd: 0.0033, dataforseoUsd: 0.0267, source: 'keyword_check' });
  });

  it('a website verified after the money was spent does not take it; one verified before it does', async () => {
    const [late] = await db.insert(schema.sites).values({ orgId: ids.org, domain: 'nobody.test', country: 'United States', verificationToken: 't2', verifiedAt: new Date() }).returning();
    await syncCosts({ readLedger: reader(ledger) });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:e4') })).toMatchObject({ orgId: null });
    await db.update(schema.sites).set({ verifiedAt: ago(24 * 60) }).where(eq(schema.sites.id, late.id));
    await syncCosts({ readLedger: reader(ledger) });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:e4') })).toMatchObject({ orgId: ids.org });
    // and back to unattributed for the rest of the suite
    await db.update(schema.costEvents).set({ orgId: null, siteId: null }).where(eq(schema.costEvents.eventKey, 'engine:e4'));
    await db.delete(schema.creditLedger).where(eq(schema.creditLedger.refKey, 'cost:engine:e4'));
    await db.delete(schema.sites).where(eq(schema.sites.id, late.id));
  });

  it('the runs page: app runs and the engine\'s own work, newest first, one cursor, nothing repeated', async () => {
    const all = (await boss.get('/api/admin/runs?period=all&limit=200')).body;
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: { rows: { id: string }[]; nextCursor: string | null } = (await boss.get(`/api/admin/runs?period=all&limit=2${cursor ? `&cursor=${cursor}` : ''}`)).body;
      seen.push(...page.rows.map((x) => x.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.rows.map((x: { id: string }) => x.id));
    expect(new Set(seen).size).toBe(seen.length);
    expect(all.total).toBe(seen.length);
    const sched = (await boss.get('/api/admin/runs?period=all&origin=schedule')).body.rows;
    expect(sched.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(['engine:e3', 'engine:e4']));
    expect(sched.every((x: { origin: string }) => x.origin === 'schedule')).toBe(true);
    expect(sched.find((x: { id: string }) => x.id === 'engine:e4')).toMatchObject({ orgId: '', orgName: 'Unattributed', credits: null });
    expect(sched.find((x: { id: string }) => x.id === 'engine:e3').credits).toBe(4.5);
    expect((await boss.get('/api/admin/runs?period=all&status=failed&origin=schedule')).body.rows).toEqual([]);
  });

  it('the overview: total cost = every company + unattributed; bills say where they come from', async () => {
    const o = (await boss.get('/api/admin/overview?period=all')).body;
    const cs = (await boss.get('/api/admin/companies?period=all')).body as { money: { cost: { totalUsd: number; claudeUsd: number } } }[];
    const sum = cs.reduce((a, c) => a + c.money.cost.totalUsd, 0);
    expect(o.money.cost.totalUsd).toBeCloseTo(sum + o.unattributed.totalUsd, 4);
    expect(o.unattributed.totalUsd).toBeCloseTo(0.02, 6);
    expect(o.money.revenueUsd).toBeGreaterThanOrEqual(25);
    const anth = o.bills.find((b: { provider: string }) => b.provider === 'anthropic');
    expect(anth).toMatchObject({ source: 'unavailable', billedUsd: null });
    expect(anth.note).toMatch(/ANTHROPIC_ADMIN_API_KEY/);
    const dfs = o.bills.find((b: { provider: string }) => b.provider === 'dataforseo');
    // 20 -> 19.8, 19.8 -> 19.75: the balance fell by 0.25
    expect(dfs).toMatchObject({ source: 'engine-ledger' });
    expect(dfs.billedUsd).toBeCloseTo(0.25, 6);
    expect(o.daily.length).toBeGreaterThan(0);
    const detail = (await boss.get(`/api/admin/companies/${ids.org}?period=all`)).body;
    expect(detail.byMode.map((m: { mode: string }) => m.mode)).toEqual(expect.arrayContaining(['keyword', 'ai_visibility', 'rank_tracker', 'verdict', 'keyword_check', 'audit']));
    expect(detail.sites_[0]).toMatchObject({ domain: 'costco.test', verified: true });
    expect(detail.members_[0]).toMatchObject({ email: 'owner@costs.test', role: 'owner' });
    expect(detail.creditEntries.length).toBeGreaterThan(0);
  });

  it('a deleted company: its cost stays unattributed for good, its revenue stays in the totals', async () => {
    const { org } = await company('gone@costs.test', 'Gone Co');
    await db.update(schema.organizations).set({ createdAt: ago(3 * 24 * 60) }).where(eq(schema.organizations.id, org.id));
    await db.insert(schema.sites).values({ orgId: org.id, domain: 'gone.test', country: 'United States', verificationToken: 'g', verifiedAt: ago(2 * 24 * 60) });
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'grant', credits: 70, paidUsd: 7 });
    const g = () => [...ledger(), { run_id: 'g1', key: 'schedule:ai_pulse', mode: 'ai_pulse', status: 'done', domain: 'gone.test', ai_usd: 0.1, dfs_usd: 0, measured_usd: 0.1, estimated_usd: 0, settled_at: ago(15).toISOString() }];
    await syncCosts({ readLedger: reader(g) });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:g1') })).toMatchObject({ orgId: org.id });
    const revenueBefore = (await boss.get('/api/admin/overview?period=all')).body.money.revenueUsd;
    expect((await boss.del(`/api/admin/companies/${org.id}`, { confirm: 'wrong' })).status).toBe(400);
    expect((await boss.del(`/api/admin/companies/${org.id}`, { confirm: org.slug })).body).toEqual({ ok: true });
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) })).toBeUndefined();
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:g1') })).toMatchObject({ orgId: null, detachedFrom: 'Gone Co' });
    const grant = (await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgName, 'Gone Co') })).find((e) => e.kind === 'grant');
    expect(grant).toMatchObject({ orgId: null, paidUsd: 7 });
    const o = (await boss.get('/api/admin/overview?period=all')).body;
    expect(o.money.revenueUsd).toBe(revenueBefore);
    expect(o.deletedCompanies).toMatchObject({ revenueUsd: 7, creditsGranted: 70 });
    expect(o.deletedCompanies.cost.totalUsd).toBeCloseTo(0.1, 6);
    // another company verifies the same domain long before: the deleted company's cost is still nobody's
    const heir = await company('heir@costs.test', 'Heir Co');
    await db.update(schema.organizations).set({ createdAt: ago(10 * 24 * 60) }).where(eq(schema.organizations.id, heir.org.id));
    await db.insert(schema.sites).values({ orgId: heir.org.id, domain: 'gone.test', country: 'United States', verificationToken: 'h', verifiedAt: ago(9 * 24 * 60) });
    await syncCosts({ readLedger: reader(g), full: true });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, 'engine:g1') })).toMatchObject({ orgId: null });
    expect(await credits(heir.org.id)).toBe(0);
    expect((await boss.get('/api/admin/activity')).body.some((x: { action: string }) => x.action === 'company.deleted')).toBe(true);
  });
});

describe('credit enforcement', () => {
  const verdict = { mode: 'verdict', keyword: 'crm software', country: 'United States' };
  it('off by default: a company with no credits still runs', async () => {
    const { c, org } = await company('free@enforce.test', 'Free Co');
    expect((await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) }))!.creditsEnforced).toBe(false);
    expect((await c.post(`/api/orgs/${org.id}/runs`, verdict)).status).toBe(200);
  });

  it('on: refused with a customer sentence when the credits cannot cover the run; allowed once granted; in-flight runs hold theirs', async () => {
    const { c, org } = await company('paid@enforce.test', 'Paid Co');
    expect((await boss.patch(`/api/admin/companies/${org.id}`, { creditsEnforced: true })).body.credits.enforced).toBe(true);
    const refused = await c.post(`/api/orgs/${org.id}/runs`, verdict);
    expect(refused.status).toBe(402);
    expect(refused.body.code).toBe('credits');
    expect(refused.body.error).toMatch(/^Your company has no credits left for this run/);
    const run = await db.query.runs.findFirst({ where: eq(schema.runs.orgId, org.id) });
    expect(run).toBeUndefined();
    // exactly one run's worth: the first starts, the second is refused while the first holds its credits
    const est = 0.2 * 3 / 0.1 + 0.01;
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'grant', credits: Math.ceil(est * 1.6) });
    expect((await c.post(`/api/orgs/${org.id}/runs`, verdict)).status).toBe(200);
    const second = await c.post(`/api/orgs/${org.id}/runs`, verdict);
    expect(second.status).toBe(402);
    expect(second.body.error).toMatch(/held by analyses still running/);
    expect(second.body.error).not.toMatch(/\$/); // credits only: never a dollar figure
    // the keyword check path is held to it too
    const owner = await db.query.users.findFirst({ where: eq(schema.users.email, 'paid@enforce.test') });
    const o = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) });
    const [site] = await db.insert(schema.sites).values({ orgId: org.id, domain: 'paid.test', country: 'United States', verificationToken: 'p' }).returning();
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'adjust', credits: -1000 });
    await expect(reserveCheck({ org: o!, site, user: owner!, keyword: 'crm', country: 'US' })).rejects.toMatchObject({ statusCode: 402, code: 'credits' });
  });

  it('new companies take the settings: sign-up credits and enforcement', async () => {
    await boss.put('/api/admin/settings', { creditValueUsd: 0.1, markup: 3, signupCredits: 50, enforceForNewCompanies: true });
    const { org } = await company('new@enforce.test', 'Fresh Co');
    const o = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) });
    expect(o!.creditsEnforced).toBe(true);
    const entries = (await boss.get(`/api/admin/companies/${org.id}/credits`)).body;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'grant', credits: 50, paidUsd: 0, note: 'Welcome credits' });
    await boss.put('/api/admin/settings', { creditValueUsd: 0.1, markup: 3, signupCredits: 0, enforceForNewCompanies: false });
  });
});

describe('suspension', () => {
  it('ends the sessions, refuses every sign-in, and is undone by unsuspending', async () => {
    const u = await signUp(app, 'bad@actor.test');
    const id = await userId('bad@actor.test');
    expect((await u.c.get('/api/me')).body.user.email).toBe('bad@actor.test');
    const r = (await boss.patch(`/api/admin/users/${id}`, { suspended: true })).body;
    expect(r).toMatchObject({ suspended: true, activeSessions: 0 });
    const after = await u.c.get('/api/me/sessions');
    expect(after.status).toBe(401);
    const login = await new Client(app).post('/api/auth/login', { email: 'bad@actor.test', password: PW });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ code: 'account_suspended', error: 'This account is suspended. Contact support.' });
    // a session that was somehow left behind is refused too
    const { sha256 } = await import('../src/lib/crypto');
    await db.insert(schema.sessions).values({ id: sha256('leftover-token'), userId: id, expiresAt: new Date(Date.now() + 86_400_000) });
    const left = new Client(app);
    left.jar.set('sid', 'leftover-token');
    const lr = await left.get('/api/me/sessions');
    expect(lr.status).toBe(401);
    expect(lr.body.code).toBe('account_suspended');
    expect(await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, id) })).toBeUndefined();

    expect((await boss.patch(`/api/admin/users/${id}`, { suspended: false })).body.suspended).toBe(false);
    expect((await new Client(app).post('/api/auth/login', { email: 'bad@actor.test', password: PW })).status).toBe(200);
    const acts = (await boss.get('/api/admin/activity')).body.map((x: { action: string }) => x.action);
    expect(acts).toEqual(expect.arrayContaining(['user.suspended', 'user.unsuspended']));
  });

  it('a suspended person\'s API keys start nothing (REST and MCP go through the same check)', async () => {
    const { c, org, userId: uid } = await company('keyed@actor.test', 'Keyed Co');
    const key = (await c.post(`/api/orgs/${org.id}/api-keys`, { name: 'ci', scopes: ['read', 'run'] })).body;
    expect(key.token).toBeTruthy();
    const start = () =>
      app.inject({ method: 'POST', url: '/api/v1/runs', headers: { authorization: `Bearer ${key.token}` }, payload: { mode: 'verdict', keyword: 'crm software', country: 'United States' } });
    expect((await start()).statusCode).toBeLessThan(300);
    await boss.patch(`/api/admin/users/${uid}`, { suspended: true });
    const refused = await start();
    expect([refused.statusCode, refused.json().code]).toEqual([403, 'key_owner_suspended']);
    // and the run path itself refuses a suspended person, whoever calls it
    const { createRun } = await import('../src/services/runs');
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, uid) });
    const o = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) });
    await expect(createRun({ user: user!, org: o!, role: 'owner' }, { mode: 'verdict', keyword: 'crm', country: 'United States' } as never)).rejects.toMatchObject({ statusCode: 403, code: 'account_suspended' });
  });

  it('an admin cannot suspend or delete themselves, nor lock out the last platform admin', async () => {
    const self = await boss.patch(`/api/admin/users/${bossId}`, { suspended: true });
    expect(self.status).toBe(400);
    expect((await boss.del(`/api/admin/users/${bossId}`, {})).status).toBe(400);
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, bossId) }))!.suspendedAt).toBeNull();
  });

  it('revokes a person\'s sessions on request', async () => {
    const u = await signUp(app, 'many@sessions.test');
    await new Client(app).post('/api/auth/login', { email: 'many@sessions.test', password: PW });
    const r = (await boss.post(`/api/admin/users/${await userId('many@sessions.test')}/sessions/revoke`)).body;
    expect(r).toEqual({ ok: true, revoked: 2 });
    expect((await u.c.get('/api/me')).body).toBeNull();
  });
});

describe('people', () => {
  it('creates a person with a company and a set-password link that works', async () => {
    const r = await boss.post('/api/admin/users', { email: 'made@people.test', name: 'Made', newCompanyName: 'Made Co' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ expiresInHours: 72, user: { email: 'made@people.test', emailVerified: true, hasPassword: false } });
    expect(r.body.user.companies).toEqual([expect.objectContaining({ name: 'Made Co', role: 'owner' })]);
    const token = new URL(r.body.setPasswordUrl).searchParams.get('token');
    expect((await new Client(app).post('/api/auth/reset', { token, password: PW })).status).toBe(200);
    expect((await new Client(app).post('/api/auth/login', { email: 'made@people.test', password: PW })).status).toBe(200);
    expect((await boss.post('/api/admin/users', { email: 'made@people.test', name: 'Again' })).status).toBe(409);
    // into an existing company, with a role
    const { org } = await company('host@people.test', 'Host Co');
    const m = (await boss.post('/api/admin/users', { email: 'joined@people.test', name: 'Joined', orgId: org.id, role: 'viewer' })).body;
    expect(m.user.companies).toEqual([expect.objectContaining({ id: org.id, role: 'viewer' })]);
    expect((await boss.get('/api/admin/users?q=joined@people')).body).toHaveLength(1);
  });

  it('delete: refused for the only owner of a company with other members; sole-member companies are asked about', async () => {
    const { org, userId: ownerId } = await company('owner@del.test', 'Del Co');
    const member = (await boss.post('/api/admin/users', { email: 'member@del.test', name: 'Member', orgId: org.id, role: 'member' })).body.user;
    const r = await boss.del(`/api/admin/users/${ownerId}`, {});
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('sole_owner');
    expect(r.body.companies).toEqual([expect.objectContaining({ id: org.id })]);

    // last owner: neither demoted nor removed; once another owner exists both work
    expect((await boss.put(`/api/admin/users/${ownerId}/memberships`, { orgId: org.id, role: 'admin' })).body.code).toBe('last_owner');
    expect((await boss.del(`/api/admin/users/${ownerId}/memberships/${org.id}`)).body.code).toBe('last_owner');
    expect((await boss.put(`/api/admin/users/${member.id}/memberships`, { orgId: org.id, role: 'owner' })).status).toBe(200);
    expect((await boss.put(`/api/admin/users/${ownerId}/memberships`, { orgId: org.id, role: 'admin' })).body.companies[0].role).toBe('admin');
    expect((await boss.del(`/api/admin/users/${ownerId}/memberships/${org.id}`)).body.companies).toEqual([]);
    expect(await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.userId, ownerId)) })).toBeUndefined();

    const solo = await company('solo@del.test', 'Solo Co');
    const ask = await boss.del(`/api/admin/users/${solo.userId}`, {});
    expect(ask.status).toBe(409);
    expect(ask.body.code).toBe('sole_member_companies');
    expect(ask.body.companies).toEqual([expect.objectContaining({ id: solo.org.id, slug: solo.org.slug })]);
    const done = (await boss.del(`/api/admin/users/${solo.userId}`, { soleCompanies: 'delete' })).body;
    expect(done).toMatchObject({ ok: true, deletedCompanies: [expect.objectContaining({ id: solo.org.id })] });
    expect(await db.query.users.findFirst({ where: eq(schema.users.id, solo.userId) })).toBeUndefined();
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, solo.org.id) })).toBeUndefined();

    const keep = await company('keep@del.test', 'Keep Co');
    expect((await boss.del(`/api/admin/users/${keep.userId}`, { soleCompanies: 'keep' })).body.keptCompanies).toHaveLength(1);
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, keep.org.id) })).toBeTruthy();
  });
});

describe('companies and the CSV', () => {
  it('lists, searches, updates (logged) and exports with formulas defused', async () => {
    const { org } = await company('csv@export.test', '=HYPERLINK("http://evil","x")');
    const found = (await boss.get(`/api/admin/companies?q=${encodeURIComponent('HYPERLINK')}`)).body;
    expect(found.map((x: { id: string }) => x.id)).toEqual([org.id]);
    const up = (await boss.patch(`/api/admin/companies/${org.id}`, { monthlyBudgetUsd: 42, disabled: true })).body;
    expect(up).toMatchObject({ monthlyBudgetUsd: 42, disabled: true });
    const res = await boss.get('/api/admin/export/companies.csv?period=all');
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/text\/csv/);
    expect(res.text.split('\r\n')[0]).toMatch(/^company,slug,kind,created_at,disabled,members,websites,runs,failed_runs,claude_usd/);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(res.text).not.toMatch(/(^|\r\n|,)=HYPERLINK/);
    const acts = (await boss.get('/api/admin/activity?limit=5')).body;
    expect(acts.length).toBeLessThanOrEqual(5);
    expect(acts[0]).toMatchObject({ action: 'company.updated', actor: 'boss@admin.test', target: { type: 'company', id: org.id } });
  });
});

describe('credits in the panel: lots, requests, packs, plans (2026-10-19)', () => {
  const DAY = 86_400_000;
  it('the new routes are for platform admins only', async () => {
    const u = await signUp(app, 'nosy2@user.test');
    const id = '00000000-0000-4000-8000-000000000000';
    for (const url of [`/api/admin/companies/${id}/lots`, `/api/admin/companies/${id}/absorbed`, '/api/admin/credit-requests']) {
      expect((await u.c.get(url)).status, url).toBe(403);
      expect((await new Client(app).get(url)).status, url).toBe(401);
    }
    expect((await boss.get(`/api/admin/companies/${id}/lots`)).status).toBe(404);
  });

  it('lots: a grant with requestId fulfils the request; the lot is a 12-month pack, listed first among live lots by expiry', async () => {
    const { c, org } = await company('lots@credits.test', 'Lots Co');
    const req = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'standard', note: 'PO 77' })).body;
    expect(req).toMatchObject({ status: 'pending', credits: 2000 });
    const waiting = (await boss.get('/api/admin/credit-requests')).body;
    expect(waiting).toContainEqual(expect.objectContaining({ id: req.id, orgId: org.id, orgName: 'Lots Co' }));
    const url = `/api/admin/companies/${org.id}/credits`;
    const g = await boss.post(url, { kind: 'grant', credits: req.credits, paidUsd: req.priceUsd, expires: 'pack', requestId: req.id });
    expect(g.status).toBe(200);
    // a short grant (10 days) and a never-expiring one
    expect((await boss.post(url, { kind: 'grant', credits: 50, expires: 10, note: 'Trial top-up' })).status).toBe(200);
    expect((await boss.post(url, { kind: 'grant', credits: 25, expires: 'never', note: 'Goodwill' })).status).toBe(200);
    const lots = (await boss.get(`/api/admin/companies/${org.id}/lots`)).body as { source: string; credits: number; remaining: number; expiresAt: string | null; note: string }[];
    const pack = lots.find((l) => l.source === 'pack')!;
    expect(pack).toMatchObject({ credits: 2000, remaining: 2000 });
    const days = (new Date(pack.expiresAt!).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
    // the order credits are used in: soonest expiry first, never-expiring last
    expect(lots.map((l) => l.note)).toEqual(['Trial top-up', expect.any(String), 'Goodwill']);
    expect(lots[0]!.source).toBe('grant');
    expect(lots[2]!.expiresAt).toBeNull();
    const all = (await boss.get('/api/admin/credit-requests?status=all')).body as { id: string; status: string }[];
    expect(all.find((x) => x.id === req.id)!.status).toBe('fulfilled');
    expect((await boss.get('/api/admin/credit-requests')).body.some((x: { id: string }) => x.id === req.id)).toBe(false);
    // once fulfilled it is neither fulfilled again nor cancellable
    expect((await boss.post(url, { kind: 'grant', credits: 2000, paidUsd: 100, requestId: req.id })).status).toBe(409);
    expect((await boss.post(`/api/admin/credit-requests/${req.id}/cancel`)).status).toBe(404);
    // a waiting one is cancelled by the admin
    const r2 = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'starter' })).body;
    expect((await boss.post(`/api/admin/credit-requests/${r2.id}/cancel`)).body).toMatchObject({ id: r2.id, status: 'cancelled', orgId: org.id });
  });

  it('absorbed over quotes: the credits runs did not pay beyond their quote, in credits and dollars', async () => {
    const { addCreditEntry } = await import('../src/services/admin/credits');
    const { org } = await company('absorbed@credits.test', 'Absorbed Co');
    const empty = (await boss.get(`/api/admin/companies/${org.id}/absorbed`)).body;
    expect(empty).toMatchObject({ period: 'month', credits: 0, listUsd: 0, runs: 0 });
    await addCreditEntry(db, { orgId: org.id, kind: 'usage', credits: -12, note: 'Used', ref: { creditValueUsd: 0.05, origin: 'on_demand', absorbed: 4 }, refKey: 'cost:test:absorbed1' });
    await addCreditEntry(db, { orgId: org.id, kind: 'usage', credits: -8, note: 'Used', ref: { creditValueUsd: 0.05, origin: 'on_demand' }, refKey: 'cost:test:absorbed2' });
    const a = (await boss.get(`/api/admin/companies/${org.id}/absorbed?period=all`)).body;
    expect(a).toMatchObject({ period: 'all', credits: 4, listUsd: 0.2, runs: 1 });
    expect(a.costUsd).toBeCloseTo(0.2 / a.markup, 4);
  });

  it('settings: packs with a discount round-trip; a bad pack id is refused; a save without changes logs nothing', async () => {
    const s = (await boss.get('/api/admin/settings')).body;
    const body = { creditValueUsd: s.creditValueUsd, markup: s.markup, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies };
    const packs = [
      { id: 'starter', credits: 500, discountPct: 0 },
      { id: 'bulk', credits: 10000, discountPct: 10 },
    ];
    const saved = (await boss.put('/api/admin/settings', { ...body, creditPacks: packs, packExpiryMonths: 6, planRollover: false, signupExpiryDays: 30 })).body;
    expect(saved).toMatchObject({ creditPacks: packs, packExpiryMonths: 6, planRollover: false, signupExpiryDays: 30 });
    expect((await boss.get('/api/admin/settings')).body).toMatchObject({ creditPacks: packs, packExpiryMonths: 6, planRollover: false, signupExpiryDays: 30 });
    const bad = await boss.put('/api/admin/settings', { ...body, creditPacks: [{ id: 'Big Pack!', credits: 500, discountPct: 0 }] });
    expect(bad.status).toBe(400);
    expect((await boss.put('/api/admin/settings', { ...body, creditPacks: [{ id: 'x', credits: 500, discountPct: 60 }] })).status).toBe(400);
    const before = (await boss.get('/api/admin/activity?limit=1')).body[0];
    await boss.put('/api/admin/settings', { ...body, creditPacks: packs, packExpiryMonths: 6, planRollover: false, signupExpiryDays: 30 });
    expect((await boss.get('/api/admin/activity?limit=1')).body[0].id).toBe(before.id);
    // back to the defaults for the tests after this one
    await boss.put('/api/admin/settings', { ...body, creditPacks: s.creditPacks, packExpiryMonths: s.packExpiryMonths, planRollover: s.planRollover, signupExpiryDays: s.signupExpiryDays });
  });

  it('a plan: its first month is granted at once, and only once a month whatever the PATCHes', async () => {
    const { org } = await company('plan@panel.test', 'Plan Panel Co');
    const r = await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 1000 });
    expect(r.status).toBe(200);
    expect(r.body.planMonthlyCredits).toBe(1000);
    const planLots = async () => ((await boss.get(`/api/admin/companies/${org.id}/lots`)).body as { source: string; credits: number }[]).filter((l) => l.source === 'plan');
    expect(await planLots()).toEqual([expect.objectContaining({ credits: 1000 })]);
    await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 1000 });
    await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 1500 });
    await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 0 });
    await boss.patch(`/api/admin/companies/${org.id}`, { planMonthlyCredits: 800 });
    expect(await planLots()).toHaveLength(1);
    expect((await boss.get(`/api/admin/companies/${org.id}`)).body.planMonthlyCredits).toBe(800);
  });
});
