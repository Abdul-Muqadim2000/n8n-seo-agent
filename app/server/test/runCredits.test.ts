import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { clientSafePayload, customerSafePayload, DEFAULT_PLATFORM_SETTINGS, isCostKey } from '@seo/shared';

// Credits (app/docs/CREDITS.md) as a customer reads them on a run, a report and an error: the run's quote, what the ledger charged it
// (the failed-run return included, capped at the quote), its state; a report payload with no provider cost at any depth but with the
// credits the work used and Google Ads CPC kept; an engine refusal naming a dollar balance or a provider read as a capacity limit.
// On a real Postgres (PGlite, every migration) through the app's own routes.

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
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return { ...real, rows: vi.fn(async () => []), siteRows: vi.fn(async () => []), executions: vi.fn(async () => []), invalidateSite: vi.fn() };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const { addCreditEntry } = await import('../src/services/admin/credits');
const { quoteCredits } = await import('../src/services/billing');
const { quoteOf, runCreditsOf } = await import('../src/services/runCredits');
const { CAPACITY_ERROR, customerError } = await import('../src/lib/customerError');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
let c: Awaited<ReturnType<typeof signUp>>['c'];
let orgId: string;

beforeAll(async () => {
  app = await buildApp();
  const u = await signUp(app, 'owner@runcredits.test');
  c = u.c;
  orgId = (await c.post('/api/orgs', { name: 'Run Credits Co' })).body.id;
});
afterAll(async () => {
  await app.close();
});

const newRun = async (o: Partial<typeof schema.runs.$inferInsert>) =>
  (await db.insert(schema.runs).values({ orgId, mode: 'verdict', title: 'Verdict', status: 'completed', input: { mode: 'verdict' }, ...o }).returning())[0];
const usage = (runId: string, credits: number, extra: Record<string, unknown> = {}, refKey?: string) =>
  addCreditEntry(db, { orgId, kind: 'usage', credits, ref: { runId, origin: 'on_demand', ...extra }, refKey: refKey ?? `test:${runId}:${credits}` });

describe('a run in credits', () => {
  it('the same quote rounding as the credit check', () => {
    for (const usd of [0, 0.0001, 0.12, 0.2, 0.84, 1.4, 3.333]) expect(quoteOf(usd, DEFAULT_PLATFORM_SETTINGS)).toBe(quoteCredits(usd, DEFAULT_PLATFORM_SETTINGS));
  });

  it('states: free, held while it runs, quoted until it settles, charged, not charged when it failed', () => {
    const s = DEFAULT_PLATFORM_SETTINGS;
    const r = (status: string, quotedCredits: number | null, est = 0) => ({ status, quotedCredits, engineCostEstimateUsd: null, estimatedCostUsd: est });
    expect(runCreditsOf(r('completed', null, 0), undefined, s)).toEqual({ quoted: 0, charged: null, state: 'free', capped: false });
    expect(runCreditsOf(r('running', 12), undefined, s).state).toBe('held');
    expect(runCreditsOf(r('accepted', 12), undefined, s).state).toBe('held');
    expect(runCreditsOf(r('completed', 12), undefined, s).state).toBe('quoted');
    expect(runCreditsOf(r('completed', 12), { charged: 9, capped: false }, s)).toEqual({ quoted: 12, charged: 9, state: 'charged', capped: false });
    expect(runCreditsOf(r('failed', 12), { charged: 0, capped: false }, s).state).toBe('not_charged');
    // a run from before credits: quoted now from its own estimate ($0.20 × 60 = 12)
    expect(runCreditsOf(r('completed', null, 0.2), undefined, s).quoted).toBe(12);
  });

  it('the runs list and the run page carry credits from the ledger, and no provider cost', async () => {
    const charged = await newRun({ quotedCredits: 12, estimatedCostUsd: 0.2, actualCostUsd: 0.15 });
    await usage(charged.id, -9);
    const capped = await newRun({ quotedCredits: 5, estimatedCostUsd: 0.08, actualCostUsd: 0.3 });
    await usage(capped.id, -5, { absorbed: 13 });
    const failed = await newRun({ status: 'failed', quotedCredits: 8, error: 'boom' });
    await usage(failed.id, -3);
    await usage(failed.id, 3, {}, `failed:${failed.id}`);
    const running = await newRun({ status: 'running', quotedCredits: 20 });

    const list = await c.get(`/api/orgs/${orgId}/runs`);
    expect(list.status).toBe(200);
    const by = (id: string) => list.body.items.find((r: { id: string }) => r.id === id);
    expect(by(charged.id).credits).toEqual({ quoted: 12, charged: 9, state: 'charged', capped: false });
    expect(by(capped.id).credits).toEqual({ quoted: 5, charged: 5, state: 'charged', capped: true });
    expect(by(failed.id).credits).toEqual({ quoted: 8, charged: 0, state: 'not_charged', capped: false });
    expect(by(running.id).credits).toEqual({ quoted: 20, charged: null, state: 'held', capped: false });
    expect(JSON.stringify(list.body)).not.toMatch(/costUsd|CostUsd|cost_usd|engineCostBasis|actualCost/);

    const one = await c.get(`/api/orgs/${orgId}/runs/${charged.id}`);
    expect(one.body.run.credits).toEqual({ quoted: 12, charged: 9, state: 'charged', capped: false });
    expect(one.body.run).not.toHaveProperty('estimatedCostUsd');
  });
});

describe('an error as the customer reads it', () => {
  it('a dollar balance or a provider becomes the capacity sentence; anything else is kept', () => {
    expect(customerError('The search-data account is too low for this run ($0.42 left; it needs about $0.60).')).toBe(CAPACITY_ERROR);
    expect(customerError('AI budget of $15 per day reached')).toBe(CAPACITY_ERROR);
    expect(customerError('DataForSEO answered 40101')).toBe(CAPACITY_ERROR);
    expect(customerError('Claude is overloaded')).toBe(CAPACITY_ERROR);
    expect(customerError('Anthropic API error 529')).toBe(CAPACITY_ERROR);
    expect(customerError('The site could not be crawled (403).')).toBe('The site could not be crawled (403).');
    expect(customerError(null)).toBeNull();
  });

  it('the run page shows the sentence; the stored error is untouched (the admin panel reads it)', async () => {
    const raw = 'The search-data account is too low for this run ($0.42 left; top it up).';
    const r = await newRun({ status: 'failed', quotedCredits: 4, error: raw });
    const one = await c.get(`/api/orgs/${orgId}/runs/${r.id}`);
    expect(one.body.run.error).toBe(CAPACITY_ERROR);
    expect((await db.query.runs.findFirst({ where: eq(schema.runs.id, r.id) }))!.error).toBe(raw);
  });
});

describe('a report payload served to the company', () => {
  const payload = {
    health_score: 71,
    run_ledger: { dataforseo_usd: 0.4, ai_usd: 0.2, by_node: { 'SERP API': 0.1 }, ai_nodes: ['Copywriter'] },
    cost_usd: 0.6,
    run_cost_estimate_usd: 0.8,
    run_cost_estimate_basis: 'Claude $0.58 (calibrated); search data $0.04',
    ai_cost: { usd: 0.2, measured_usd: 0.2 },
    dataforseo_calls: 4,
    keyword_data: { keyword: 'crm software', volume: 1900, cpc: 12.4, cpc_usd: 12.4 },
    keywords: [{ keyword: 'erp', cpc: 3.1, primary_cpc: 3.1 }],
  };

  it('has no provider cost key at any depth and keeps Google Ads CPC', () => {
    const p = customerSafePayload(payload, { used: 9, state: 'charged' });
    expect(p).toEqual({
      health_score: 71,
      keyword_data: { keyword: 'crm software', volume: 1900, cpc: 12.4, cpc_usd: 12.4 },
      keywords: [{ keyword: 'erp', cpc: 3.1, primary_cpc: 3.1 }],
      credits_used: 9,
      credits_state: 'charged',
    });
    expect(['run_ledger', 'by_node', 'ai_nodes', 'ai_cost', 'dataforseo_calls', 'run_cost_estimate_basis', 'cost_usd'].every(isCostKey)).toBe(true);
    expect(['cpc', 'cpc_usd', 'primary_cpc', 'credits_used', 'health_score'].some(isCostKey)).toBe(false);
    // a client person: the same strip, without the credits
    expect(clientSafePayload(payload)).not.toHaveProperty('credits_used');
  });

  it('GET report for an owner: stripped, with the credits its run used', async () => {
    const r = await newRun({ quotedCredits: 12 });
    await usage(r.id, -7);
    const [rep] = await db.insert(schema.reports).values({ orgId, runId: r.id, stage: 'verdict', status: 'completed', title: 'Verdict', payload }).returning();
    const got = await c.get(`/api/orgs/${orgId}/reports/${rep.id}`);
    expect(got.status).toBe(200);
    expect(got.body.payload).toMatchObject({ health_score: 71, credits_used: 7, credits_state: 'charged', keyword_data: { cpc: 12.4 } });
    expect(JSON.stringify(got.body.payload)).not.toMatch(/run_ledger|cost_usd|dataforseo|by_node|run_cost/);
  });

  it('a schedule\'s report: the credits of the engine execution that wrote it, when the ledger has them', async () => {
    await addCreditEntry(db, { orgId, kind: 'usage', credits: -4.5, ref: { runId: null, engineRunId: 'exec-77', origin: 'autopilot' }, refKey: 'cost:engine:exec-77' });
    const [rep] = await db.insert(schema.reports).values({ orgId, stage: 'ai_visibility', status: 'completed', title: 'AI visibility', scheduled: true, payload: { execution_id: 'exec-77', run_ledger: { run_id: 'exec-77' } } }).returning();
    const got = await c.get(`/api/orgs/${orgId}/reports/${rep.id}`);
    expect(got.body.payload).toEqual({ execution_id: 'exec-77', credits_used: 4.5, credits_state: 'charged' });
  });
});

describe('webhooks and exports', () => {
  it('a run event carries the run\'s credits and the customer\'s error, never a cost', async () => {
    const { runSummary } = await import('../src/services/webhooks');
    const r = await newRun({ status: 'failed', quotedCredits: 4, estimatedCostUsd: 0.07, error: 'The search-data account is too low for this run ($0.42 left).' });
    const s = runSummary(r, { quoted: 4, charged: 0, state: 'not_charged', capped: false });
    expect(s).toMatchObject({ id: r.id, error: CAPACITY_ERROR, credits: { quoted: 4, charged: 0, state: 'not_charged' } });
    expect(JSON.stringify(s)).not.toMatch(/usd|cost/i);
  });

  it('the runs table exports credits_quoted / credits_charged; AI visibility exports credits, not cost_usd', async () => {
    const { tableRowsV1 } = await import('../src/services/exports');
    const { siteRows } = await import('../src/n8n/client');
    const [site] = await db.insert(schema.sites).values({ orgId, domain: 'runcredits.example.com', country: 'United States', verificationToken: 't', verifiedAt: new Date() }).returning();
    const r = await newRun({ siteId: site.id, quotedCredits: 6, estimatedCostUsd: 0.1, actualCostUsd: 0.08 });
    await usage(r.id, -5);
    const runs = await tableRowsV1({ id: orgId }, site, 'runs', {});
    const row = runs.items.find((x) => x.run_id === r.id)!;
    expect(row).toMatchObject({ credits_quoted: 6, credits_charged: 5 });
    expect(Object.keys(row).filter((k) => /usd|cost/i.test(k))).toEqual([]);
    expect(runs.columns.map((c) => c.name).filter((n) => /usd|cost/i.test(n))).toEqual([]);

    vi.mocked(siteRows).mockResolvedValueOnce([{ run_id: 'v1', checked_at: '2026-10-01T07:00:00Z', prompts: 8, cost_usd: 0.1 }] as never);
    const ai = await tableRowsV1({ id: orgId }, site, 'ai_visibility', {});
    expect(ai.items[0]).toMatchObject({ run_id: 'v1', credits: 6 });
    expect(Object.keys(ai.items[0]!).filter((k) => /usd|cost/i.test(k))).toEqual([]);
  });
});
