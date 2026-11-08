import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// FX-A (2026-11-08, reviews CONSISTENCY H1 / PERF_SAFETY H1 + L2 / L13): a Trial keyword-intelligence run is our team's own check. End to end on
// a real Postgres (PGlite, every migration): it is quoted and charged 0 credits to the client company, and the run, its reports (also a refusal
// at the door, stage `rejected` without a mode), the delivery log and digests, the Overview / Pipeline readers, the runs list and run detail,
// the credit usage rows, the company's month spend, API v1 / MCP runs and reports are for platform admins only. On is unchanged.

const st = vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@kitrial.test';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  return { mode: 'trial' as string, killed: false, starts: [] as Record<string, unknown>[] };
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (b: Record<string, unknown>) => (st.starts.push(b), { ok: true, status: 202, requestId: `kitrial-${++n}`, etaMinutes: 6, error: null, duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async (table: string) => (table === 'cache' && st.killed ? [{ key: 'ki:kill', value: '1' }] : [])),
    siteRows: vi.fn(async (table: string, domain: string) => (table === 'monitors' ? [{ domain, ki_mode: st.mode }] : [])),
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
const { signUp } = await import('./helpers/client');
const runs = await import('../src/services/runs');
const { deliverReport } = await import('../src/services/reportDelivery');
const { listRuns, getRun, listReports } = await import('../src/services/apiV1');
const { orgSpendSince, platformSpendSince } = await import('../src/services/spend');
const { ladderAppSources } = await import('../src/services/ladders');
const { addCreditEntry } = await import('../src/services/admin/credits');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
const verify = (email: string) => db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
const userId = async (email: string) => (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!.id;

let boss: Awaited<ReturnType<typeof signUp>>['c'];
let client: Awaited<ReturnType<typeof signUp>>['c'];
let orgId = '';
let siteId = '';
const DOMAIN = 'trial-client.example';
const body = () => ({ mode: 'competitors', siteId, country: 'United States', competitors: [], seeds: [], kiForce: false, emailCopy: false });

beforeAll(async () => {
  app = await buildApp();
  const b = await signUp(app, 'boss@kitrial.test', 'Boss');
  boss = b.c;
  await verify('boss@kitrial.test');
  const c = await signUp(app, 'owner@kitrial.test', 'Owner');
  client = c.c;
  await verify('owner@kitrial.test');
  orgId = (await client.post('/api/orgs', { name: 'Trial Client' })).body.id;
  const [s] = await db.insert(schema.sites).values({ orgId, domain: DOMAIN, country: 'United States', verificationToken: 't', verifiedAt: new Date(), trackingStatus: 'active' }).returning();
  siteId = s.id;
  // our team works inside the client's company (as planned for the Trial runs, DESIGN.md §8)
  await db.insert(schema.memberships).values({ orgId, userId: await userId('boss@kitrial.test'), role: 'admin' });
});
afterAll(async () => {
  await app.close();
});

const orgRow = async () => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) }))!;
const v1 = async () => ({ org: await orgRow(), auth: 'api_key' as const, key: null, scopes: ['read' as never] });

describe('FX-A: a Trial run is our team\'s, free and private', () => {
  let trialRun: { id: string; requestId: string | null } = { id: '', requestId: null };
  let reportIds: string[] = [];

  it('a platform admin starts it: quoted 0 credits, marked, and the KI overview quotes 0', async () => {
    st.mode = 'trial';
    const ov = await boss.get(`/api/orgs/${orgId}/sites/${siteId}/ki`);
    expect(ov.status).toBe(200);
    expect(ov.body).toMatchObject({ mode: 'trial', visible: true, credits: { competitors: 0, research: 0 } });
    const r = await boss.post(`/api/orgs/${orgId}/runs`, body());
    expect(r.status).toBe(200);
    const row = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.id) }))!;
    expect(row.quotedCredits).toBe(0);
    expect((row.input as Record<string, unknown>).kiTrial).toBe(true);
    trialRun = { id: row.id, requestId: row.requestId };
    // a client of the company cannot start it, and sees Trial as Off
    expect((await client.post(`/api/orgs/${orgId}/runs`, body())).status).toBe(403);
    expect((await client.get(`/api/orgs/${orgId}/sites/${siteId}/ki`)).body).toMatchObject({ mode: 'off', visible: false });
  });

  it('the run is in no list of the company and its detail is a 404 for the client; the admin sees both', async () => {
    const mine = (await client.get(`/api/orgs/${orgId}/runs`)).body.items.map((x: { id: string }) => x.id);
    expect(mine).not.toContain(trialRun.id);
    expect((await client.get(`/api/orgs/${orgId}/runs/${trialRun.id}`)).status).toBe(404);
    expect((await boss.get(`/api/orgs/${orgId}/runs`)).body.items.map((x: { id: string }) => x.id)).toContain(trialRun.id);
    expect((await boss.get(`/api/orgs/${orgId}/runs/${trialRun.id}`)).status).toBe(200);
    // API v1 / MCP: never, whoever made the key
    const ctx = await v1();
    expect((await listRuns(ctx as never, {})).items.map((x) => x.id)).not.toContain(trialRun.id);
    await expect(getRun(ctx as never, trialRun.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('its reports (the KI answer and a refusal at the door with no mode) carry the one mark and reach nobody but the admin', async () => {
    const org = await orgRow();
    const a = await runs.ingestCallback(org, { stage: 'ki_competitors', request_id: trialRun.requestId, domain: DOMAIN, mode: 'trial', status: 'ok', market: 'US-en', sections: [], summary: {}, competitors: [], listings: [], platforms: [] });
    const b = await runs.ingestCallback(org, { stage: 'rejected', request_id: trialRun.requestId, domain: DOMAIN, status: 'rejected', reason: 'busy' });
    reportIds = [a.reportId, b.reportId];
    for (const id of reportIds) {
      const rep = (await db.query.reports.findFirst({ where: eq(schema.reports.id, id) }))!;
      expect(rep.summary.trial).toBe(true);
      expect((await client.get(`/api/orgs/${orgId}/reports/${id}`)).status).toBe(404);
      expect((await boss.get(`/api/orgs/${orgId}/reports/${id}`)).status).toBe(200);
    }
    const listed = (await client.get(`/api/orgs/${orgId}/reports?siteId=${siteId}`)).body.map((x: { id: string }) => x.id);
    for (const id of reportIds) expect(listed).not.toContain(id);
    const adminListed = (await boss.get(`/api/orgs/${orgId}/reports?siteId=${siteId}`)).body.map((x: { id: string }) => x.id);
    for (const id of reportIds) expect(adminListed).toContain(id);
    // the readers behind the Overview's "Latest reports", the Pipeline and the dashboards (no viewer = nobody's Trial)
    expect((await runs.reportsList(orgId, { siteId, limit: 12 })).map((x) => x.id).filter((id) => reportIds.includes(id))).toEqual([]);
    // API v1 reports
    expect((await listReports((await v1()) as never, {})).items.map((x) => x.id).filter((id) => reportIds.includes(id))).toEqual([]);
  });

  it('delivery: not sent, not held, no row in the company\'s delivery log, even when sent by hand', async () => {
    await db.update(schema.organizations).set({ deliverySettings: { frequency: 'each', email: { enabled: true, recipients: ['owner@kitrial.test'] }, webhook: { enabled: false } } as never }).where(eq(schema.organizations.id, orgId)).catch(() => undefined);
    for (const id of reportIds) {
      const r = await deliverReport(orgId, id, log, { force: true });
      expect(r.delivered).toBe(false);
    }
    const logRows = await db.query.reportDeliveries.findMany({ where: eq(schema.reportDeliveries.orgId, orgId) });
    expect(logRows.filter((x) => x.reportId && reportIds.includes(x.reportId))).toEqual([]);
  });

  it('money: no usage row of the company names it, its month spend leaves it out (the platform total keeps it), no share link', async () => {
    await addCreditEntry(db, { orgId, kind: 'usage', credits: 0, note: 'Used by competitors (capped at its quote)', ref: { runId: trialRun.id, mode: 'competitors', domain: DOMAIN, origin: 'on_demand' }, refKey: `cost:test-${trialRun.id}` });
    const billing = (await client.get(`/api/orgs/${orgId}/billing`)).body;
    expect(JSON.stringify(billing.byFeature ?? [])).not.toMatch(/Competitors/);
    const act = (await client.get(`/api/orgs/${orgId}/billing/activity`)).body;
    expect(JSON.stringify(act ?? {})).not.toMatch(/competitors/i);
    const company = await orgSpendSince(db, orgId);
    const all = await platformSpendSince(db, new Date(Date.now() - 86_400_000));
    expect(company.runs).toBe(0);
    expect(all).toBeGreaterThan(0);
    expect((await boss.post(`/api/orgs/${orgId}/reports/${reportIds[0]}/shares`, {})).status).toBe(404);
  });

  it('a failed Trial run is no Needs-you item: the Pipeline never reads it', async () => {
    await db.update(schema.runs).set({ status: 'failed', error: 'x' }).where(eq(schema.runs.id, trialRun.id));
    const src = await ladderAppSources(await orgRow(), (await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) }))!);
    expect(src.runs.map((r) => r.id)).not.toContain(trialRun.id);
  });

  it('On: a run of the client is quoted credits, listed and theirs as before; the kill switch stops a run before anything is locked', async () => {
    st.mode = 'on';
    await addCreditEntry(db, { orgId, kind: 'grant', credits: 2000, note: 'test', lot: { source: 'grant', expiresAt: null } });
    // FX-L H4 / second review LOGIC N1: only explicit AVOID verdicts travel as `avoid`. The real devaicon case: "open edx provider" was
    // checked fit 0 five times and navigational once by the pre-KI check (its niche, wrongly judged): never imported
    for (const fit of [0, 0, 0, 0, 0]) await db.insert(schema.keywordChecks).values({ orgId, siteId, keyword: 'open edx provider', country: 'United States', result: { fit } });
    await db.insert(schema.keywordChecks).values({ orgId, siteId, keyword: 'open edx provider', country: 'United States', result: { fit: 1, navigational: true } });
    await db.insert(schema.reports).values({ orgId, siteId, stage: 'content', status: 'completed', title: 'Verdict: crm for customers', payload: { keyword: 'CRM for customers', verdict: 'AVOID' } });
    await db.insert(schema.reports).values({ orgId, siteId, stage: 'content', status: 'completed', title: 'Verdict: open edx hosting', payload: { keyword: 'open edx hosting', verdict: 'GO' } });
    const r = await client.post(`/api/orgs/${orgId}/runs`, body());
    expect(r.status).toBe(200);
    expect(st.starts.at(-1)?.avoid).toEqual(['crm for customers']);
    expect(await runs.kiAvoidKeywords(orgId, siteId)).not.toContain('open edx provider');
    const row = (await db.query.runs.findFirst({ where: and(eq(schema.runs.id, r.body.id), eq(schema.runs.orgId, orgId)) }))!;
    expect(row.quotedCredits).toBeGreaterThan(0);
    expect((row.input as Record<string, unknown>).kiTrial).toBeUndefined();
    expect((await client.get(`/api/orgs/${orgId}/runs`)).body.items.map((x: { id: string }) => x.id)).toContain(row.id);
    st.killed = true;
    const before = st.starts.length;
    const k = await client.post(`/api/orgs/${orgId}/runs`, { ...body(), kiForce: true });
    expect(k.status).toBe(409);
    expect(k.body.code).toBe('ki_paused');
    expect(st.starts.length).toBe(before);
    st.killed = false;
  });
});
