import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PAGE_IN_FLIGHT_HOURS, PAGE_SLOT_STAGE, PAGE_WAITING, PAGE_WRITING, runOverdueMinutes } from '@seo/shared';

// P1 (2026-11-12, prod review S1-01): the engine writes at most two pages at once. A page run that finds both slots taken waits in line and
// posts `stage: page_slot` (waiting, then started). That callback is not a report: the app run's stage and expected time follow it, so the
// watcher and the expiry never take a run in line for a lost one, and nothing is stored, delivered or announced. Real Postgres (PGlite).

vi.hoisted(() => {
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return { ...real, rows: vi.fn(async () => []), siteRows: vi.fn(async () => []), updateRows: vi.fn(async () => true), insertRows: vi.fn(async () => true), invalidateSite: vi.fn() };
});

const { db, schema } = await import('../src/db');
const runs = await import('../src/services/runs');

let org: typeof schema.organizations.$inferSelect;
beforeAll(async () => {
  [org] = await db.insert(schema.organizations).values({ name: 'Slot Co', slug: 'slot-co', hookToken: 'tok-slot', monthlyBudgetUsd: 50 }).returning();
});

async function newRun(requestId: string, over: Partial<typeof schema.runs.$inferInsert> = {}) {
  const [r] = await db
    .insert(schema.runs)
    .values({ orgId: org.id, mode: 'keyword', title: 'Page: erp dubai', status: 'accepted', requestId, input: { mode: 'keyword', keyword: 'erp dubai' }, etaMinutes: 20, acceptedAt: new Date(Date.now() - 30 * 60_000), ...over })
    .returning();
  return r;
}
const slot = (requestId: string, x: Record<string, unknown> = {}) => ({
  status: 'progress', stage: 'page_slot', request_id: requestId, execution_id: '13070', domain: 'northwind-erp.com', keyword: 'erp dubai',
  slot: 'waiting', ahead: 1, running: 2, limit: 2, waited_minutes: 0, eta_minutes: 60, note: 'Your page is waiting for a writing slot.', callback_url: 'https://x/tok', ...x,
});

describe('page_slot callbacks (P1)', () => {
  it('the shared constants: the stage, the run stages, 8 hours in flight', () => {
    expect([PAGE_SLOT_STAGE, PAGE_WAITING, PAGE_WRITING, PAGE_IN_FLIGHT_HOURS]).toEqual(['page_slot', 'page_waiting', 'page_writing', 8]);
  });

  it('a waiting page moves the run to "page_waiting" and its expected time past the wait; no report is stored', async () => {
    const run = await newRun('5001');
    const r = await runs.ingestCallback(org, slot('5001'));
    expect(r).toMatchObject({ reportId: '', runId: run.id, stage: 'page_slot' });
    const after = (await db.query.runs.findFirst({ where: eq(schema.runs.id, run.id) }))!;
    expect(after.lastStage).toBe(PAGE_WAITING);
    expect(after.status).toBe('accepted');
    expect(after.reportCount).toBe(0);
    // 30 minutes since it was accepted + the engine's 60-minute estimate
    expect(after.etaMinutes).toBeGreaterThanOrEqual(90);
    expect(after.etaMinutes).toBeLessThanOrEqual(92);
    // so the watcher counts it overdue only past 3 x that, not at 3 x the first 20-minute guess
    expect(runOverdueMinutes(after.etaMinutes)).toBeGreaterThanOrEqual(270);
    const reps = await db.select().from(schema.reports).where(eq(schema.reports.orgId, org.id));
    expect(reps).toHaveLength(0);
  });

  it('"started" moves it to "page_writing"; the expected time never shrinks', async () => {
    const run = await newRun('5002', { etaMinutes: 200 });
    await runs.ingestCallback(org, slot('5002', { slot: 'started', eta_minutes: 20 }));
    const after = (await db.query.runs.findFirst({ where: eq(schema.runs.id, run.id) }))!;
    expect(after.lastStage).toBe(PAGE_WRITING);
    expect(after.etaMinutes).toBe(200);
  });

  it('a finished or failed run, a cycle page and an unknown request change nothing', async () => {
    const done = await newRun('5003', { status: 'completed', lastStage: 'content' });
    await runs.ingestCallback(org, slot('5003'));
    expect((await db.query.runs.findFirst({ where: eq(schema.runs.id, done.id) }))!.lastStage).toBe('content');
    expect(await runs.ingestCallback(org, slot('cyc_site-a-com_20261112_content_cadence'))).toMatchObject({ reportId: '', runId: null });
    expect(await runs.ingestCallback(org, slot('cad_20261112_x'))).toMatchObject({ reportId: '', runId: null });
    const reps = await db.select().from(schema.reports).where(eq(schema.reports.orgId, org.id));
    expect(reps).toHaveLength(0);
  });

  it('the stale-run expiry honours the longer expected time of a page in line', async () => {
    const run = await newRun('5004', { createdAt: new Date(Date.now() - 4 * 3_600_000), acceptedAt: new Date(Date.now() - 4 * 3_600_000) });
    await runs.ingestCallback(org, slot('5004', { eta_minutes: 120 }));
    await runs.expireStaleRuns();
    const after = (await db.query.runs.findFirst({ where: eq(schema.runs.id, run.id) }))!;
    expect(after.status).toBe('accepted'); // 4 h old, but its expected time is now 6 h: 6 x that is far away
    const old = await newRun('5005', { createdAt: new Date(Date.now() - 4 * 3_600_000) });
    await runs.expireStaleRuns();
    expect((await db.query.runs.findFirst({ where: eq(schema.runs.id, old.id) }))!.status).toBe('failed'); // the same age with no slot news: expired as before
  });
});
