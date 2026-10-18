import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiPromptRow, AiVisibilityRow, MonitorsRow } from '@seo/shared';

// G6 (2026-10-18): the AI question panel manager through the app — the Site Admin body the engine receives (its own field names), the
// limits, roles and company isolation; the monitors read-back; and the segments the AI visibility page and the read API serve.

const st = vi.hoisted(() => ({ sent: [] as Record<string, unknown>[], role: 'admin' as string, otherOrg: false }));

vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async (_req: unknown, orgId: string, _siteId: string, need: string) => {
    if (orgId !== '00000000-0000-0000-0000-000000000001') { const e = new Error('Website not found') as Error & { statusCode: number }; e.statusCode = 404; throw e; }
    const rank: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    if ((rank[st.role] ?? 0) < (rank[need] ?? 0)) { const e = new Error('Not allowed') as Error & { statusCode: number }; e.statusCode = 403; throw e; }
    return { org: { id: orgId }, site: { id: 'site-1', domain: 'techand.ai', verifiedAt: new Date() }, role: st.role };
  }),
  orgAccess: vi.fn(),
  requireVerified: vi.fn(),
}));
vi.mock('../src/n8n/client', () => ({
  siteAdmin: vi.fn(async (body: Record<string, unknown>) => (st.sent.push(body), { ok: true, action: String(body.action), affected: 3, error: null })),
  siteRows: vi.fn(async () => []),
  insertRows: vi.fn(), deleteRows: vi.fn(), ensureTable: vi.fn(), invalidateSite: vi.fn(),
}));
vi.mock('../src/db', () => ({ db: { update: () => ({ set: () => ({ where: async () => undefined }) }), query: {} }, schema: { sites: { id: 'id' } } }));
vi.mock('../src/services/audit', () => ({ audit: vi.fn() }));
vi.mock('../src/auth/google', () => ({ G_COOKIE: 'g', googleAuthUrl: vi.fn() }));
vi.mock('../src/services/google', () => ({ assertGa4ForDomain: vi.fn(), findGscProperty: vi.fn(), gscOwnerCheck: vi.fn(), listGa4Properties: vi.fn() }));
vi.mock('../src/services/runs', () => ({ routeSiteToApp: vi.fn() }));
vi.mock('../src/services/verify', () => ({ fetchPublicText: vi.fn(), verify: vi.fn() }));

const { siteRoutes } = await import('../src/routes/sites');
const { monitorsFromRow } = await import('../src/services/data');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => reply.status(err.statusCode ?? 500).send({ error: err.message }));
  await app.register(siteRoutes);
});
afterAll(() => app.close());
beforeEach(() => { st.sent = []; st.role = 'admin'; });

const url = (org = '00000000-0000-0000-0000-000000000001') => `/api/orgs/${org}/sites/00000000-0000-0000-0000-000000000002/admin`;
const post = (payload: unknown, org?: string) => app.inject({ method: 'POST', url: url(org), payload: payload as object });

describe('the panel manager through Site Admin', () => {
  it('sends the engine its own field names: question objects, edit with prompt_id, enable / pin / unpin', async () => {
    const r = await post({ action: 'ai_prompts', add: ['Which payroll software suits a small company?', { prompt: 'Which ERP partner fits a retailer in Riyadh?', persona: 'CFO', cluster: 'erp', stage: 'decision', market: 'SA-en', pinned: true }],
      edit: [{ promptId: 'p_1', persona: 'IT manager' }, { promptId: 'p_2', prompt: 'Which ERP partners serve retailers in Jeddah?' }], remove: ['p_3'], enable: ['p_4'], pin: ['p_5'], unpin: ['p_6'] });
    expect(r.statusCode).toBe(200);
    expect(st.sent).toHaveLength(1);
    const b = st.sent[0];
    expect(b).toMatchObject({ action: 'ai_prompts', domain: 'techand.ai', site_id: 'site_techand-ai', remove: ['p_3'], enable: ['p_4'], pin: ['p_5'], unpin: ['p_6'] });
    expect(b.add).toEqual(['Which payroll software suits a small company?', { prompt: 'Which ERP partner fits a retailer in Riyadh?', persona: 'CFO', cluster: 'erp', stage: 'decision', market: 'SA-en', pinned: true }]);
    expect(b.edit).toEqual([{ prompt_id: 'p_1', persona: 'IT manager' }, { prompt_id: 'p_2', prompt: 'Which ERP partners serve retailers in Jeddah?' }]);
  });
  it('a CSV import of 500 questions is one call; 501 is refused before the engine is asked', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ prompt: `Which provider is best for need number ${i}?`, persona: 'CFO' }));
    expect((await post({ action: 'ai_prompts', add: many(500) })).statusCode).toBe(200);
    expect((st.sent[0].add as unknown[]).length).toBe(500);
    st.sent = [];
    expect((await post({ action: 'ai_prompts', add: many(501) })).statusCode).toBe(400);
    expect(st.sent).toEqual([]);
  });
  it('a question that is not a question, or a stage that is not one of three, is refused', async () => {
    expect((await post({ action: 'ai_prompts', add: ['short'] })).statusCode).toBe(400);
    expect((await post({ action: 'ai_prompts', add: [{ prompt: 'Which ERP partner fits a retailer?', stage: 'purchase' }] })).statusCode).toBe(400);
    expect(st.sent).toEqual([]);
  });
  it('only an admin changes the panel; another company never reaches the engine', async () => {
    st.role = 'member';
    expect((await post({ action: 'ai_prompts', remove: ['p_1'] })).statusCode).toBe(403);
    st.role = 'admin';
    expect((await post({ action: 'ai_prompts', remove: ['p_1'] }, '00000000-0000-0000-0000-000000000009')).statusCode).toBe(404);
    expect(st.sent).toEqual([]);
  });
  it('buyer roles and markets are cleared with a single space (Site Admin keeps an empty field), the pulse settings pass through', async () => {
    const r = await post({ action: 'monitors', monitors: { aiPromptsMax: 200, aiPersonas: [], aiMarkets: [], aiPulseMode: 'sample', aiPulsePerWeek: 2 } });
    expect(r.statusCode).toBe(200);
    expect(st.sent[0].monitors).toMatchObject({ ai_prompts_max: 200, ai_personas: ' ', ai_markets: ' ', ai_pulse_mode: 'sample', ai_pulse_per_week: 2 });
  });
});

describe('monitorsFromRow', () => {
  it('reads the panel settings back; a stored row with no size keeps 20', () => {
    const m = monitorsFromRow({ site_id: 's', domain: 'techand.ai', ai_prompts_max: 0, ai_personas: 'CFO, IT manager', ai_markets: 'SA-en', ai_pulse_mode: 'sample', ai_pulse_per_week: 3 } as unknown as MonitorsRow)!;
    expect(m).toMatchObject({ aiPromptsMax: 20, aiPersonas: ['CFO', 'IT manager'], aiMarkets: ['SA-en'], aiPulseMode: 'sample', aiPulsePerWeek: 3 });
    expect(monitorsFromRow({ site_id: 's', domain: 'techand.ai', ai_prompts_max: 300 } as unknown as MonitorsRow)).toMatchObject({ aiPromptsMax: 300, aiPulseMode: 'auto', aiPulsePerWeek: 0 });
  });
});

// keep the row types honest for the fields this change reads
const _row: Partial<AiPromptRow & AiVisibilityRow> = { persona: 'CFO', market: 'SA-en', pinned: true, fit_note: '', segments_json: '', panel_json: '', chunks: 2 };
void _row;
