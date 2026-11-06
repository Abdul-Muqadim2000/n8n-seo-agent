import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// AIR (2026-11-06, n8n/seo-agent/docs/ai-ranking-2026-11-05/DESIGN.md §6.7): the AI ranking setting through Site Admin (only the fields the
// person changed, in the engine's names, beside an ordinary monitors save that never carries them; the paid readings for platform admins
// only), the plan read for an `on` website only, and an engine without the AI ranking tables read as "no plan". Synthetic data only.

const st = vi.hoisted(() => ({ sent: [] as Record<string, unknown>[], role: 'admin' as string, platform: false, rows: {} as Record<string, unknown[]>, fail: false }));

vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async (_req: unknown, orgId: string, _siteId: string, need: string) => {
    const rank: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    if ((rank[st.role] ?? 0) < (rank[need] ?? 0)) {
      const e = new Error('Not allowed') as Error & { statusCode: number };
      e.statusCode = 403;
      throw e;
    }
    return { org: { id: orgId }, site: { id: 'site-1', domain: 'nova-demo.example', verifiedAt: new Date() }, role: st.role, user: { id: 'u1', email: 'a@nova-demo.example' } };
  }),
  orgAccess: vi.fn(),
  requireVerified: vi.fn(),
  isPlatformAdmin: vi.fn(() => st.platform),
}));
vi.mock('../src/n8n/client', () => ({
  siteAdmin: vi.fn(async (body: Record<string, unknown>) => (st.sent.push(body), { ok: true, action: String(body.action), affected: 1, error: null })),
  siteRows: vi.fn(async (table: string) => {
    if (st.fail) throw new Error('n8n down');
    return st.rows[table] ?? [];
  }),
  insertRows: vi.fn(),
  deleteRows: vi.fn(),
  ensureTable: vi.fn(),
  invalidateSite: vi.fn(),
}));
vi.mock('../src/db', () => ({ db: { update: () => ({ set: () => ({ where: async () => undefined }) }), query: {} }, schema: { sites: { id: 'id' } } }));
vi.mock('../src/services/audit', () => ({ audit: vi.fn() }));
vi.mock('../src/auth/google', () => ({ G_COOKIE: 'g', googleAuthUrl: vi.fn() }));
vi.mock('../src/services/google', () => ({ assertGa4ForDomain: vi.fn(), findGscProperty: vi.fn(), gscOwnerCheck: vi.fn(), listGa4Properties: vi.fn() }));
vi.mock('../src/services/runs', () => ({ routeSiteToApp: vi.fn() }));
vi.mock('../src/services/verify', () => ({ fetchPublicText: vi.fn(), verify: vi.fn() }));

const { siteRoutes, adminAuditDetails } = await import('../src/routes/sites');
const { aiRankPlanFor, aiRankShadowData, monitorsFromRow } = await import('../src/services/data');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => reply.status(err.statusCode ?? 500).send({ error: err.message }));
  await app.register(siteRoutes);
});
afterAll(() => app.close());
beforeEach(() => {
  st.sent = [];
  st.role = 'admin';
  st.platform = false;
  st.rows = {};
  st.fail = false;
});

const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/orgs/00000000-0000-0000-0000-000000000001/sites/00000000-0000-0000-0000-000000000002/admin', payload: payload as object });

describe('the AI ranking setting through Site Admin', () => {
  it('sends only the fields changed, in the engine names, inside the monitors body', async () => {
    st.platform = true;   // RC-4: while AI ranking is rolling out only a platform admin sets the mode (aiRankAccess.test.ts)
    const r = await post({ action: 'monitors', monitors: {}, aiRank: { mode: 'shadow', reserve: true } });
    expect(r.statusCode).toBe(200);
    expect(st.sent[0]).toMatchObject({ action: 'monitors', domain: 'nova-demo.example' });
    expect(st.sent[0].monitors).toEqual({ ai_rank_mode: 'shadow', ai_rank_reserve: true });
  });
  it('an ordinary monitors save carries no AI ranking field', async () => {
    await post({ action: 'monitors', monitors: { aiVisibility: true, aiPagesPerMonth: 2 } });
    expect(Object.keys(st.sent[0].monitors as object).some((k) => k.startsWith('ai_rank'))).toBe(false);
  });
  it('the paid readings: refused for an owner or admin, sent for a platform admin', async () => {
    expect((await post({ action: 'monitors', monitors: {}, aiRank: { fanoutN: 20 } })).statusCode).toBe(403);
    expect(st.sent).toEqual([]);
    st.platform = true;
    expect((await post({ action: 'monitors', monitors: {}, aiRank: { fanoutN: 20, mentions: true } })).statusCode).toBe(200);
    expect(st.sent[0].monitors).toEqual({ ai_rank_fanout_n: 20, ai_rank_mentions: true });
  });
  it('members cannot change it; a bad value never reaches the engine', async () => {
    st.role = 'member';
    expect((await post({ action: 'monitors', monitors: {}, aiRank: { mode: 'on' } })).statusCode).toBe(403);
    st.role = 'admin';
    expect((await post({ action: 'monitors', monitors: {}, aiRank: { mode: 'live' } })).statusCode).toBe(400);
    expect(st.sent).toEqual([]);
  });
  it('the audit row says what was changed', () => {
    expect(adminAuditDetails({ action: 'monitors', monitors: {}, aiRank: { mode: 'on' } } as never, 1)).toMatchObject({ aiRank: { mode: 'on' } });
    expect(adminAuditDetails({ action: 'monitors', monitors: { aiPulse: true } } as never, 1)).not.toHaveProperty('aiRank');
  });
  it('the monitors read-back never includes the AI ranking fields (so a later save cannot send them back)', () => {
    const m = monitorsFromRow({ ai_rank_mode: 'on', ai_rank_reserve: true, ai_rank_fanout_n: 10 } as never)!;
    expect(Object.keys(m).some((k) => /rank/i.test(k))).toBe(false);
  });
});

describe('the AI ranking plan read', () => {
  const run = { domain: 'nova-demo.example', run_id: 'r1', mode: 'on', checked_at: '2026-11-09T09:30:00Z', chosen_json: '[{"action_id":"a1","lever":"L01","executor":"human"}]', memo_json: '' };
  it('reads nothing for an off or trial website', async () => {
    st.rows = { aiRankRuns: [run] };
    expect(await aiRankPlanFor('nova-demo.example', { ai_rank_mode: 'shadow' } as never)).toBeNull();
    expect(await aiRankPlanFor('nova-demo.example', undefined)).toBeNull();
  });
  it('an on website gets its plan; an engine without the tables (or a failed read) gives no plan, never an error', async () => {
    st.rows = { aiRankRuns: [run], aiRankActions: [{ action_id: 'a1', status: 'queued', mode: 'on' }] };
    const p = await aiRankPlanFor('nova-demo.example', { ai_rank_mode: 'on' } as never);
    expect(p?.actions[0]).toMatchObject({ actionId: 'a1', status: 'queued', executor: 'human' });
    st.rows = {};
    expect(await aiRankPlanFor('nova-demo.example', { ai_rank_mode: 'on' } as never)).toBeNull();
    st.fail = true;
    expect(await aiRankPlanFor('nova-demo.example', { ai_rank_mode: 'on' } as never)).toBeNull();
    const shadow = await aiRankShadowData({ id: 'site-1', domain: 'nova-demo.example' } as never);
    expect(shadow).toEqual({ settings: { mode: 'off', reserve: false, fanoutN: 0, mentions: false, brave: false }, weeks: [] });
  });
});
