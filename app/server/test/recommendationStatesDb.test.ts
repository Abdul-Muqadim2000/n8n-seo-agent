import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recommendation } from '@seo/shared';

// FX-SERVER (CR17 review R3 L1 / L2 / L3 / L5), on a real Postgres (PGlite, every migration): the stored states of the recommendations and the
// dismiss / restore / check routes, which had no database test. The engine and the website's data are mocked: the queue each read computes is
// set by the test (`q.recs`), and one verifier can act in the middle of a read (`q.during`) to play a person's click made meanwhile.

vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
});
const q = vi.hoisted(() => ({ recs: [] as Recommendation[], during: null as null | (() => Promise<void>) }));
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => ({
  ...(await orig<typeof import('../src/n8n/client')>()),
  rows: vi.fn(async () => []),
  siteRows: vi.fn(async () => []),
  insertRows: vi.fn(async () => true),
  updateRows: vi.fn(async () => true),
  deleteRows: vi.fn(async () => true),
  siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
  invalidateSite: vi.fn(),
  executions: vi.fn(async () => []),
}));
vi.mock('../src/services/recommendations', async (orig) => {
  const real = await orig<typeof import('../src/services/recommendations')>();
  return { ...real, loadBundle: vi.fn(async () => bundle()), recommendQueue: vi.fn(() => q.recs) };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const S = await import('../src/services/recommendationStates');
vi.setConfig({ testTimeout: 30_000 });

function bundle() {
  return {
    search: { periods: [], queries: [] },
    content: { items: [] },
    technical: { findings: [], audits: [], selectedAuditId: null },
    rankings: { ladders: [] },
    ai: {},
    backlinks: { refs: [] },
  } as never;
}
// two sources about one search (one card): the weekly report's step and the rank tracker's, plus an item of its own
const rec = (id: string, issueKey: string, title = id): Recommendation => ({ id, issueKey, category: 'search', priority: 'medium', title, detail: 'd' });
const A = rec('search:striking:erp dubai', 'kw:erp dubai', 'Move erp dubai into the top 3');
const B = rec('engine:site_tracker:striking:erp dubai', 'kw:erp dubai', 'Weekly report: erp dubai');
const C = rec('setup:ga4', 'setup:ga4', 'Connect GA4');

let app: FastifyInstance;
let orgId = '';
let site: typeof schema.sites.$inferSelect;
let client: Awaited<ReturnType<typeof signUp>>['c'];
const T = schema.recommendationStates;
const rowOf = async (key: string) => (await db.select().from(T).where(and(eq(T.siteId, site.id), eq(T.recKey, key))))[0];
const ctx = (now = new Date()) => S.verifyContext(site, bundle(), [], now);
const read = async (now = new Date()) => S.boardOf(q.recs, await S.syncRecommendationStates({ id: orgId }, ctx(now), q.recs), now.getTime());
const url = (p: string) => `/api/orgs/${orgId}/sites/${site.id}/recommendations${p}`;

beforeAll(async () => {
  app = await buildApp();
  const u = await signUp(app, 'recs@acme.test');
  client = u.c;
  orgId = (await client.post('/api/orgs', { name: 'Recs Co' })).body.id;
  [site] = await db.insert(schema.sites).values({ orgId, domain: 'recs-co.test', country: 'United Arab Emirates', verificationToken: 't-recs', verifiedAt: new Date() }).returning();
});
afterAll(async () => app?.close());
beforeEach(async () => {
  await db.delete(T).where(eq(T.siteId, site.id));
  q.recs = [A, B, C];
  q.during = null;
  S.registerRecVerifier('search', async () => {
    if (q.during) {
      const f = q.during;
      q.during = null;
      await f();
    }
    return { outcome: 'unknown' };
  });
});

describe('every item of the queue has its own state; the tabs fold (review R3 L2)', () => {
  it('a folded member gets its own row and is never "Expired" while its source reports it', async () => {
    const b1 = await read();
    expect(b1.todo.map((r) => r.id)).toEqual([A.id, C.id]);
    expect((await rowOf(B.id))?.state).toBe('open');
    // next week the queue order changes: B is the card now and A is folded under it; neither expires
    q.recs = [B, A, C];
    const b2 = await read(new Date(Date.now() + 7 * 864e5));
    expect(b2.todo.map((r) => r.id)).toEqual([B.id, C.id]);
    expect(b2.expired).toEqual([]);
    expect((await rowOf(A.id))?.state).toBe('open');
  });
  it('a resolved card never hides an open sibling nothing checked', async () => {
    await read();
    await db.update(T).set({ state: 'resolved', evidence: 'In the top 3 now.', stateAt: new Date() }).where(eq(T.recKey, A.id));
    // the search verifier keeps A resolved (its check says so), B has no check of its own
    S.registerRecVerifier('search', async ({ rec: r }) => (r.id === A.id ? { outcome: 'resolved', evidence: 'In the top 3 now.' } : { outcome: 'unknown' }));
    const b = await read();
    expect(b.resolved.map((r) => r.id)).toEqual([A.id]);
    expect(b.todo.map((r) => r.id)).toEqual([B.id, C.id]);
  });
});

describe('a read never overwrites a person\'s click made during it (review R3 L1)', () => {
  it('a dismissal made while the read verifies the item stays', async () => {
    await read();
    // the row is stale (last seen 7 hours ago), so this read writes it; a person dismisses it while the verifier runs
    await db.update(T).set({ lastSeenAt: new Date(Date.now() - 7 * 3600e3) }).where(eq(T.recKey, A.id));
    q.during = async () => {
      await db.update(T).set({ state: 'dismissed', dismissedReason: 'not_relevant', evidence: 'Dismissed: Not relevant to my business', stateAt: new Date(), updatedAt: new Date() }).where(and(eq(T.siteId, site.id), eq(T.recKey, A.id)));
    };
    const b = await read();
    expect((await rowOf(A.id))?.state).toBe('dismissed');
    expect(b.todo.map((r) => r.id)).not.toContain(A.id);
  });
});

describe('bounded growth (review R3 L3)', () => {
  it('settled rows nothing reported for 180 days are deleted; a gone dismissed item is listed for 90 days only', async () => {
    await read();
    const old = new Date(Date.now() - 200 * 864e5);
    const mid = new Date(Date.now() - 120 * 864e5);
    const base = { orgId, siteId: site.id, snapshot: { id: 'x', category: 'search', priority: 'low', title: 'Old', detail: 'd' }, evidence: '', firstSeenAt: old };
    await db.insert(T).values([
      { ...base, recKey: 'old:resolved', issueKey: 'old:resolved', state: 'resolved', lastSeenAt: old, stateAt: old },
      { ...base, recKey: 'old:dismissed', issueKey: 'old:dismissed', state: 'dismissed', lastSeenAt: old, stateAt: old },
      { ...base, recKey: 'mid:dismissed', issueKey: 'mid:dismissed', state: 'dismissed', lastSeenAt: mid, stateAt: mid },
      { ...base, recKey: 'old:open', issueKey: 'old:open', state: 'open', lastSeenAt: old, stateAt: old },
    ]);
    expect(await S.pruneRecommendationStates(site.id, new Date(), q.recs.map((r) => r.id))).toBe(2);
    expect(await rowOf('old:resolved')).toBeUndefined();
    expect(await rowOf('old:dismissed')).toBeUndefined();
    expect((await rowOf('mid:dismissed'))?.state).toBe('dismissed');
    expect((await rowOf('old:open'))?.state).toBeTruthy();   // unsettled: a check may still move it (it expires on the next read)
    const b = await read();
    expect(b.dismissed.map((r) => r.id)).not.toContain('mid:dismissed');
  });
});

describe('the routes: dismiss, restore, check (members and above)', () => {
  it('dismiss takes the whole card (its folded sources too), restore brings them back, both in the audit log', async () => {
    await read();
    const d = await client.post(url('/dismiss'), { key: A.id, reason: 'other', note: 'We do not sell in Dubai any more' });
    expect(d.status).toBe(200);
    expect(d.body.recommendation).toMatchObject({ id: A.id, state: 'dismissed' });
    expect((await rowOf(A.id))?.state).toBe('dismissed');
    expect((await rowOf(B.id))?.state).toBe('dismissed');
    expect((await rowOf(C.id))?.state).toBe('open');
    const board = await client.get(url('/board'));
    expect(board.status).toBe(200);
    expect(board.body.todo.map((r: Recommendation) => r.id)).toEqual([C.id]);
    expect(board.body.dismissed[0].dismissed.note).toBe('We do not sell in Dubai any more');   // the company's own people see the note
    const r = await client.post(url('/restore'), { key: A.id });
    expect(r.status).toBe(200);
    expect((await rowOf(A.id))?.state).toBe('open');
    expect((await rowOf(B.id))?.state).toBe('open');
    const log = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, orgId));
    expect(log.map((x) => x.action)).toEqual(expect.arrayContaining(['recommendation.dismissed', 'recommendation.restored']));
  });
  it('refuses a dismissal without a reason, "another reason" without a line, and an unknown key', async () => {
    await read();
    expect((await client.post(url('/dismiss'), { key: A.id, reason: 'nope' })).status).toBe(400);
    expect((await client.post(url('/dismiss'), { key: A.id, reason: 'other' })).status).toBe(400);
    expect((await client.post(url('/dismiss'), { key: 'no:such', reason: 'not_relevant' })).status).toBe(404);
    expect((await client.post(url('/restore'), { key: A.id })).status).toBe(400);
  });
  it('check answers the item as it stands, a folded member too', async () => {
    await read();
    const c = await client.post(url('/check'), { key: B.id });
    expect(c.status).toBe(200);
    expect(c.body.recommendation).toMatchObject({ id: B.id, state: 'open' });
    expect((await client.post(url('/check'), { key: 'no:such' })).status).toBe(404);
  });
});
