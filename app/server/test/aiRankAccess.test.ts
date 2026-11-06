import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Review C (2026-11-06, docs/ai-ranking-2026-11-05/REVIEW_C_ONMODE_APP.md): RC-4 (until the owner opens AI ranking to clients only a platform
// admin sets Trial / On and the reserved slot; the server refuses anyone else), RC-9 (an engine without the AI ranking column gives no setting,
// so the app never offers one it cannot keep), RC-12 (the trial comparison: any platform admin, member or not; nobody else). Synthetic data.

const st = vi.hoisted(() => ({ sent: [] as Record<string, unknown>[], role: 'owner' as string, platform: false, member: true, rows: {} as Record<string, unknown[]> }));

vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async (_req: unknown, orgId: string, _siteId: string, need: string) => {
    const rank: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    if (!st.member) {
      const e = new Error('Company not found') as Error & { statusCode: number };
      e.statusCode = 404;
      throw e;
    }
    if ((rank[st.role] ?? 0) < (rank[need] ?? 0)) {
      const e = new Error('Not allowed') as Error & { statusCode: number };
      e.statusCode = 403;
      throw e;
    }
    return { org: { id: orgId }, site: { id: 'site-1', domain: 'nova-demo.example', verifiedAt: new Date() }, role: st.role, user: { id: 'u1', email: 'a@nova-demo.example' } };
  }),
  orgAccess: vi.fn(),
  requireVerified: vi.fn(),
  requireUser: vi.fn(() => ({ id: 'u1', email: 'a@nova-demo.example' })),
  isUuid: (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
  isPlatformAdmin: vi.fn(() => st.platform),
}));
vi.mock('../src/n8n/client', () => ({
  siteAdmin: vi.fn(async (body: Record<string, unknown>) => (st.sent.push(body), { ok: true, action: String(body.action), affected: 1, error: null })),
  siteRows: vi.fn(async (table: string) => st.rows[table] ?? []),
  rows: vi.fn(async () => []),
  insertRows: vi.fn(),
  deleteRows: vi.fn(),
  ensureTable: vi.fn(),
  invalidateSite: vi.fn(),
}));
vi.mock('../src/db', async () => ({
  db: { update: () => ({ set: () => ({ where: async () => undefined }) }), query: { sites: { findFirst: vi.fn(async () => ({ id: 'site-9', orgId: 'org-9', domain: 'client-demo.example' })) } } },
  schema: await import('../src/db/schema'),
}));
vi.mock('../src/services/audit', () => ({ audit: vi.fn() }));
vi.mock('../src/auth/google', () => ({ G_COOKIE: 'g', googleAuthUrl: vi.fn() }));
vi.mock('../src/services/google', () => ({ assertGa4ForDomain: vi.fn(), findGscProperty: vi.fn(), gscOwnerCheck: vi.fn(), listGa4Properties: vi.fn() }));
vi.mock('../src/services/runs', () => ({ routeSiteToApp: vi.fn() }));
vi.mock('../src/services/verify', () => ({ fetchPublicText: vi.fn(), verify: vi.fn() }));

const { siteRoutes } = await import('../src/routes/sites');
const { dataRoutes } = await import('../src/routes/data');
const { settingsData } = await import('../src/services/data');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => reply.status(err.statusCode ?? 500).send({ error: err.message }));
  await app.register(siteRoutes);
  await app.register(dataRoutes);
});
afterAll(() => app.close());
beforeEach(() => {
  st.sent = [];
  st.role = 'owner';
  st.platform = false;
  st.member = true;
  st.rows = {};
});

const ORG = '00000000-0000-0000-0000-000000000001';
const SITE = '00000000-0000-0000-0000-000000000002';
const post = (payload: unknown) => app.inject({ method: 'POST', url: `/api/orgs/${ORG}/sites/${SITE}/admin`, payload: payload as object });

describe('RC-4: only a platform admin switches AI ranking on while it is rolling out', () => {
  it('a company owner or admin: 403 for the mode or the reserve, nothing reaches the engine', async () => {
    for (const role of ['owner', 'admin']) {
      st.role = role;
      for (const aiRank of [{ mode: 'on' }, { mode: 'shadow' }, { reserve: true }]) {
        const r = await post({ action: 'monitors', monitors: {}, aiRank });
        expect(r.statusCode, `${role} ${JSON.stringify(aiRank)}`).toBe(403);
        expect(JSON.parse(r.body).error).toMatch(/rolling out to selected websites/);
      }
    }
    expect(st.sent).toEqual([]);
  });
  it('a platform admin sets it; an ordinary monitors save by an owner still goes through', async () => {
    st.platform = true;
    expect((await post({ action: 'monitors', monitors: {}, aiRank: { mode: 'on', reserve: true } })).statusCode).toBe(200);
    expect(st.sent[0].monitors).toEqual({ ai_rank_mode: 'on', ai_rank_reserve: true });
    st.platform = false;
    expect((await post({ action: 'monitors', monitors: { aiVisibility: true } })).statusCode).toBe(200);
  });
});

describe('RC-9: an engine without the AI ranking column gives no setting', () => {
  const site = { id: 'site-1', domain: 'nova-demo.example' } as never;
  it('a monitors row without ai_rank_mode: aiRank undefined; with it: the setting', async () => {
    st.rows = { monitors: [{ domain: 'nova-demo.example', ai_visibility: true }] };
    expect((await settingsData({ id: 'org' } as never, site)).aiRank).toBeUndefined();
    st.rows = { monitors: [{ domain: 'nova-demo.example', ai_rank_mode: '' }] };
    expect((await settingsData({ id: 'org' } as never, site)).aiRank).toMatchObject({ mode: 'off' });
    st.rows = { monitors: [{ domain: 'nova-demo.example', ai_rank_mode: 'on' }] };
    expect((await settingsData({ id: 'org' } as never, site)).aiRank).toMatchObject({ mode: 'on' });
  });
});

describe('RC-12: the trial comparison', () => {
  const get = () => app.inject({ method: 'GET', url: `/api/orgs/${ORG}/sites/${SITE}/data/ai/rank-shadow` });
  it('a platform admin who is not a member of the company reads it', async () => {
    st.member = false;
    st.platform = true;
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ weeks: [] });
  });
  it('a member (even the owner) who is not a platform admin gets 403', async () => {
    st.role = 'owner';
    expect((await get()).statusCode).toBe(403);
  });
});
