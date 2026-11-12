import { and, eq, like } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Who the cost sync bills, for the engine rows the 2026-11-12 production review found billed to the wrong party (real Postgres, PGlite):
// S2-01 our team's keyword-intelligence Trial runs, S2-02 the page finalize row billed a second time as autopilot.

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
  return { ...real, sendMail: vi.fn(async () => true) };
});
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    startRun: vi.fn(async () => ({ ok: true, status: 202, requestId: 'exec-x', etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null })),
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
const { signUp } = await import('./helpers/client');
const { syncCosts, attributeLedgerRow, matchFinalizeRows } = await import('../src/services/admin/costSync');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const MIN = 60_000;

async function company(email: string, name: string) {
  const u = await signUp(app, email);
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ createdAt: new Date(Date.now() - DAY) }).where(eq(schema.organizations.id, org.id));
  return org.id as string;
}
async function site(orgId: string, domain: string) {
  const [s] = await db.insert(schema.sites).values({ orgId, domain, country: 'United States', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active' }).returning();
  return s!;
}
/** an engine ledger row created `min` + 2 minutes ago and settled `min` minutes ago */
const engineRow = (o: { id: string; key: string; mode: string; usd: number; domain?: string; min?: number }) => ({
  run_id: o.id, key: o.key, mode: o.mode, status: 'done', domain: o.domain ?? '', ai_usd: o.usd, dfs_usd: 0, measured_usd: o.usd, estimated_usd: 0,
  settled_at: new Date(Date.now() - (o.min ?? 5) * MIN).toISOString(), created_at: new Date(Date.now() - ((o.min ?? 5) + 2) * MIN).toISOString(),
});
const sync = (rows: Record<string, unknown>[]) => syncCosts({ readLedger: async () => rows, full: true });
const debitOf = async (exec: string) => db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.refKey, `cost:engine:${exec}`) });
const eventOf = async (exec: string) => db.query.costEvents.findFirst({ where: eq(schema.costEvents.engineRunId, exec) });
const kiReport = (orgId: string, o: { exec: string; stage: string; mode: string; runId?: string | null; requestId?: string; trial?: boolean }) =>
  db.insert(schema.reports).values({
    orgId, runId: o.runId ?? null, stage: o.stage, status: 'accepted', title: 'x', requestId: o.requestId ?? `req-${o.exec}`, scheduled: !o.runId,
    summary: o.trial ? { trial: true } : {}, payload: { request_id: o.requestId ?? `req-${o.exec}`, run_id: o.exec, mode: o.mode, domain: 'ki.test' },
  });

beforeAll(async () => {
  app = await buildApp();
  await db.update(schema.platformSettings).set({ creditsSince: new Date(0) });
});
afterAll(async () => {
  await app.close();
});

describe('S2-01: keyword-intelligence Trial runs are never billed to the client', () => {
  let org = '';
  beforeAll(async () => {
    org = await company('ki@billing.test', 'KI Co');
    await site(org, 'ki.test');
  });

  it('a Trial run started outside the app (front door key app:<company>, no app run) is platform spend: recorded, nobody debited', async () => {
    await kiReport(org, { exec: 'ki-t1', stage: 'ki_research_started', mode: 'trial', trial: true });
    await kiReport(org, { exec: 'ki-t1', stage: 'ki_research', mode: 'trial', trial: true });
    await sync([engineRow({ id: 'ki-t1', key: `app:${org}`, mode: 'keyword_research', usd: 0.4, domain: 'ki.test' })]);
    const ev = (await eventOf('ki-t1'))!;
    expect(ev).toMatchObject({ orgId: null, runId: null, engineKey: `app:${org}`, mode: 'keyword_research' });
    expect(await debitOf('ki-t1')).toBeUndefined();
    // a later sync does not attach it to the company either (the domain is the company's verified website)
    await sync([engineRow({ id: 'ki-t1', key: `app:${org}`, mode: 'keyword_research', usd: 0.4, domain: 'ki.test' })]);
    expect((await eventOf('ki-t1'))!.orgId).toBeNull();
    expect(await debitOf('ki-t1')).toBeUndefined();
  });

  it('the Trial mark of the started notice alone is enough (the final answer may still be on its way)', async () => {
    await kiReport(org, { exec: 'ki-t2', stage: 'ki_competitors_started', mode: 'trial' });
    await sync([engineRow({ id: 'ki-t2', key: `app:${org}`, mode: 'competitors', usd: 0.1, domain: 'ki.test' })]);
    expect((await eventOf('ki-t2'))!.orgId).toBeNull();
    expect(await debitOf('ki-t2')).toBeUndefined();
  });

  it('a KI run that never reported to the app delivered nothing: not billed', async () => {
    await sync([engineRow({ id: 'ki-t3', key: `app:${org}`, mode: 'keyword_research', usd: 0.3, domain: 'ki.test' })]);
    expect((await eventOf('ki-t3'))!.orgId).toBeNull();
    expect(await debitOf('ki-t3')).toBeUndefined();
  });

  it('a Trial event is never adopted by another app run of the company that ran in the same minutes', async () => {
    const [run] = await db
      .insert(schema.runs)
      .values({ orgId: org, mode: 'verdict', title: 'v', status: 'completed', requestId: 'req-verdict-1', input: { mode: 'verdict' }, quotedCredits: 50, actualCostUsd: 0.05, createdAt: new Date(Date.now() - 2 * DAY), completedAt: new Date(Date.now() - 2 * DAY) })
      .returning();
    await kiReport(org, { exec: 'ki-t4', stage: 'ki_research_started', mode: 'trial', trial: true });
    const row = { ...engineRow({ id: 'ki-t4', key: `app:${org}`, mode: 'keyword_research', usd: 0.5, domain: 'ki.test' }), created_at: new Date(Date.now() - 2 * DAY).toISOString(), settled_at: new Date(Date.now() - 2 * DAY + MIN).toISOString() };
    await sync([row]);
    expect((await eventOf('ki-t4'))!).toMatchObject({ orgId: null, runId: null });
    expect(await debitOf('ki-t4')).toBeUndefined();
    // the verdict run is counted from its own figure instead
    const own = await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, `run:${run!.id}`) });
    expect(own).toMatchObject({ orgId: org, runId: run!.id });
  });

  it('a client\'s own KI run (On, started from the app) is billed to it once, through its run and its quote', async () => {
    const [run] = await db
      .insert(schema.runs)
      .values({ orgId: org, mode: 'keyword_research', title: 'k', status: 'running', requestId: 'req-ki-on', input: { mode: 'keyword_research' }, quotedCredits: 10 })
      .returning();
    await kiReport(org, { exec: 'ki-on1', stage: 'ki_research_started', mode: 'on', runId: run!.id, requestId: 'req-ki-on' });
    await sync([engineRow({ id: 'ki-on1', key: `app:${org}`, mode: 'keyword_research', usd: 0.4, domain: 'ki.test' })]);
    expect((await eventOf('ki-on1'))!).toMatchObject({ orgId: org, runId: run!.id, origin: 'app' });
    const d = (await debitOf('ki-on1'))!;
    expect(d.credits).toBe(-10); // $0.40 is 24 credits, capped at the run's quote of 10
    expect(d.ref).toMatchObject({ origin: 'on_demand', runId: run!.id });
  });

  it('a Trial run started from the app (quoted 0) is charged 0 even when the row is read before its final answer', async () => {
    const [run] = await db
      .insert(schema.runs)
      .values({ orgId: org, mode: 'competitors', title: 'c', status: 'running', requestId: 'req-ki-tr', input: { mode: 'competitors', kiTrial: true }, quotedCredits: 0 })
      .returning();
    await kiReport(org, { exec: 'ki-tr1', stage: 'ki_competitors_started', mode: 'trial', runId: run!.id, requestId: 'req-ki-tr', trial: true });
    await sync([engineRow({ id: 'ki-tr1', key: `app:${org}`, mode: 'competitors', usd: 0.2, domain: 'ki.test' })]);
    const all = await db.query.creditLedger.findMany({ where: and(eq(schema.creditLedger.orgId, org), like(schema.creditLedger.refKey, 'cost:engine:ki-tr1%')) });
    expect(all.reduce((s, x) => s + x.credits, 0)).toBe(0);
  });

  it('a KI run that reported and is not Trial, with no app run (an engine-started refresh), is still the website\'s', () => {
    const orgs = new Map([[org, new Date(0)]]);
    const a = attributeLedgerRow(
      { run_id: 'ki-r1', key: `app:${org}`, mode: 'keyword_research', settled_at: new Date().toISOString() },
      { runsByExec: new Map(), sitesByDomain: new Map(), sitesByEngineId: new Map(), orgs, stored: new Map(), kiTrialExecs: new Set(), kiReportedExecs: new Set(['ki-r1']) },
    );
    expect(a).toMatchObject({ orgId: org, origin: 'app' });
    const b = attributeLedgerRow(
      { run_id: 'ki-r2', key: `app:${org}`, mode: 'keyword_research', settled_at: new Date().toISOString() },
      { runsByExec: new Map(), sitesByDomain: new Map(), sitesByEngineId: new Map(), orgs, stored: new Map(), kiTrialExecs: new Set(['ki-r2']), kiReportedExecs: new Set(['ki-r2']) },
    );
    expect(b.orgId).toBeNull();
  });
});

describe('S2-02: a final version is charged once, through its own run', () => {
  let org = '';
  let siteId = '';
  beforeAll(async () => {
    org = await company('fin@billing.test', 'Fin Co');
    siteId = (await site(org, 'fin.test')).id;
  });
  const finRun = async (o: { quoted: number; minAgo: number; free?: boolean; status?: string }) => {
    const created = new Date(Date.now() - o.minAgo * MIN);
    const [r] = await db
      .insert(schema.runs)
      .values({
        orgId: org, siteId, mode: 'finalize', title: 'Final version', status: o.status ?? 'completed', requestId: `app-fin-${o.minAgo}-${o.quoted}`,
        input: { mode: 'finalize', ...(o.free ? { freeRecheck: true } : {}) }, quotedCredits: o.quoted, actualCostUsd: 0.03,
        createdAt: created, acceptedAt: created, completedAt: new Date(created.getTime() + 2 * MIN),
      })
      .returning();
    return r!;
  };
  /** the engine row of a call made `minAgo` minutes ago (it starts a few seconds after the run) */
  const finRow = (id: string, minAgo: number, usd: number, domain = 'www.fin.test') => ({
    run_id: id, key: 'schedule:page_finalize', mode: 'page_finalize', status: 'done', domain, ai_usd: usd, dfs_usd: 0, measured_usd: usd, estimated_usd: 0,
    created_at: new Date(Date.now() - minAgo * MIN + 5_000).toISOString(), settled_at: new Date(Date.now() - minAgo * MIN + 90_000).toISOString(),
  });
  const usageOfRun = async (runId: string) => (await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, org) })).filter((x) => (x.ref as { runId?: string } | null)?.runId === runId && x.kind === 'usage');

  it('the engine row is tied to the finalize run: one charge, on demand, within the quote; the run is not counted again from its own figure', async () => {
    const run = await finRun({ quoted: 2, minAgo: 120 });
    await syncCosts({ readLedger: async () => [finRow('fin-e1', 120, 0.05)], full: true, appGraceMinutes: 0 });
    expect((await eventOf('fin-e1'))!).toMatchObject({ orgId: org, runId: run.id, origin: 'app' });
    expect(await db.query.costEvents.findFirst({ where: eq(schema.costEvents.eventKey, `run:${run.id}`) })).toBeUndefined();
    const used = await usageOfRun(run.id);
    expect(used).toHaveLength(1);
    expect(used[0]!.credits).toBe(-2); // $0.05 is 3 credits, capped at the quote of 2
    expect(used[0]!.ref).toMatchObject({ origin: 'on_demand' });
    // a second sync changes nothing
    await syncCosts({ readLedger: async () => [finRow('fin-e1', 120, 0.05)], full: true, appGraceMinutes: 0 });
    expect(await usageOfRun(run.id)).toHaveLength(1);
  });

  it('the free re-make (quoted 0) is charged 0, its engine row included', async () => {
    const run = await finRun({ quoted: 0, minAgo: 90, free: true });
    await syncCosts({ readLedger: async () => [finRow('fin-e2', 90, 0.03)], full: true, appGraceMinutes: 0 });
    expect((await eventOf('fin-e2'))!.runId).toBe(run.id);
    expect((await usageOfRun(run.id)).reduce((s, x) => s + x.credits, 0)).toBe(0);
  });

  it('a Page Finalize call no app run made (our own test, a live grade) is platform spend, never the website\'s autopilot', async () => {
    await syncCosts({ readLedger: async () => [finRow('fin-e3', 60 * 24 * 3, 0.03)], full: true, appGraceMinutes: 0 });
    expect((await eventOf('fin-e3'))!).toMatchObject({ orgId: null, runId: null });
    expect(await debitOf('fin-e3')).toBeUndefined();
  });

  it('each run takes the row nearest its start; a second row in the window is not charged to it', () => {
    const t0 = Date.parse('2026-11-11T10:00:00Z');
    const run = (id: string, min: number) => ({ id, orgId: 'o', siteId: 's', userId: null, mode: 'finalize', domain: 'fin.test', createdAt: new Date(t0 + min * MIN), completedAt: new Date(t0 + (min + 2) * MIN) });
    const row = (id: string, min: number, domain = 'fin.test', usd = 0.02) => ({ run_id: id, mode: 'page_finalize', domain, ai_usd: usd, measured_usd: usd, estimated_usd: 0, created_at: new Date(t0 + min * MIN + 3_000).toISOString() });
    // N1: a $0 live grade started right at the run's start does not take its place
    const m = matchFinalizeRows([row('grade', 0, 'fin.test', 0), row('a', 0.1), row('b', 1), row('c', 30), row('d', 0, 'other.test'), { ...row('e', 30), mode: 'ai_pulse' }], [run('r1', 0), run('r2', 30)]);
    expect(m.has('grade')).toBe(false);
    expect(m.get('a')?.id).toBe('r1');
    expect(m.has('b')).toBe(false);
    expect(m.get('c')?.id).toBe('r2');
    expect(m.has('d')).toBe(false);
    expect(m.has('e')).toBe(false);
  });
});

describe('review S5: an engine figure tied to a run after its own figure was charged', () => {
  it('the app debit is given back against the run, and the engine figure is charged within the quote (not about 0)', async () => {
    const org = await company('late@billing.test', 'Late Co');
    const t = new Date(Date.now() - 3 * 3600_000);
    const [run] = await db
      .insert(schema.runs)
      .values({ orgId: org, mode: 'verdict', title: 'v', status: 'completed', requestId: 'req-late-1', input: { mode: 'verdict' }, quotedCredits: 10, actualCostUsd: 0.1, createdAt: t, acceptedAt: t, completedAt: new Date(t.getTime() + 2 * MIN) })
      .returning();
    // the engine's ledger could not be tied for an hour: the run is counted from its own figure ($0.10 = 6 credits)
    await syncCosts({ readLedger: async () => [], full: true, appGraceMinutes: 0 });
    const usage = async () => (await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, org) })).filter((x) => x.kind === 'usage');
    expect((await usage()).reduce((s, x) => s + x.credits, 0)).toBe(-6);
    // its callback names the engine execution; the engine's figure ($0.10) replaces the app's
    await db.insert(schema.reports).values({ orgId: org, runId: run!.id, stage: 'verdict', status: 'completed', title: 'x', requestId: 'req-late-1', payload: { request_id: 'req-late-1', execution_id: 'late-e1', run_ledger: {} } });
    await syncCosts({ readLedger: async () => [{ ...engineRow({ id: 'late-e1', key: `app:${org}`, mode: 'verdict', usd: 0.1, min: 170 }) }], full: true, appGraceMinutes: 0 });
    const all = await usage();
    const back = all.find((x) => x.refKey === `reprice:run:${run!.id}`)!;
    expect(back.credits).toBe(6);
    expect((back.ref as { runId?: string }).runId).toBe(run!.id);
    expect((await debitOf('late-e1'))!.credits).toBe(-6);
    expect(all.reduce((s, x) => s + x.credits, 0)).toBe(-6); // charged once, at the engine's figure
  });
});
