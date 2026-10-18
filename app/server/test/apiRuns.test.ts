import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// G4 (app/docs/INTEGRATIONS.md §4): the write API and the MCP run tools. The run path itself (`createRunWithMeta`: lock, budget,
// engine front door) is the app's own and is mocked here; what is tested is everything this layer adds or must not lose — the
// scope, the key acting as its creator (re-checked), the forms' validation, another company's website, the forms' duplicate
// warnings as a 409 that only an explicit acknowledgement passes, the dry run, the Idempotency-Key, and the MCP tool list.

const ORG_A = { id: 'org-a', name: 'Northwind', monthlyBudgetUsd: 25 };
const SITE_A = '6f1c2b3a-1d2e-4f5a-9b8c-0123456789a1';
const SITE_B = '6f1c2b3a-1d2e-4f5a-9b8c-0123456789b1'; // another company's website
const KEY = (n: string) => 'asc_' + n.repeat(43).slice(0, 43);
const RUN_KEY = KEY('r');
const READ_KEY = KEY('q');
const ORPHAN_KEY = KEY('o');

const st = vi.hoisted(() => ({
  membership: { role: 'admin' } as { role: string } | null,
  created: [] as { input: Record<string, unknown>; opts: Record<string, unknown> }[],
  replay: false,
  priorIdem: false,
  activeRuns: [] as { id: string; mode: string; keyword: string; createdAt: string }[],
}));

vi.mock('../src/config', () => ({ config: { appUrl: 'https://app.example.com', brand: 'Alaventra', isProd: false, platformAdmins: [] } }));
vi.mock('../src/db', async () => ({ db: {}, schema: await import('../src/db/schema'), sqlClient: {} }));
vi.mock('../src/services/apiKeys', () => ({
  authenticateKey: vi.fn(async (t: string) => {
    const k = (id: string, scopes: string[], createdBy: string | null) => ({ key: { id, name: id, prefix: t.slice(0, 12), scopes, createdBy }, org: ORG_A });
    if (t === RUN_KEY) return k('key-run', ['read', 'run'], 'user-1');
    if (t === READ_KEY) return k('key-read', ['read', 'publish_check'], 'user-1');
    if (t === ORPHAN_KEY) return k('key-orphan', ['read', 'run'], 'user-gone');
    return null;
  }),
  creatorMembership: vi.fn(async (_org: string, userId: string | null) => (userId === 'user-1' && st.membership ? { user: { id: 'user-1', name: 'Dana', email: 'dana@example.com' }, role: st.membership.role } : null)),
  createKey: vi.fn(),
  listKeys: vi.fn(),
  revokeKey: vi.fn(),
}));
vi.mock('../src/services/apiV1', async (orig) => {
  const real = await orig<typeof import('../src/services/apiV1')>();
  const { notFound } = await import('../src/lib/errors');
  return {
    ...real,
    siteOf: vi.fn(async (_ctx: unknown, id: unknown) => {
      if (id === SITE_A) return { id: SITE_A, orgId: 'org-a', domain: 'northwind.example', verifiedAt: new Date(), country: 'United States' };
      throw notFound('Website not found');
    }),
    getRun: vi.fn(async (_ctx: unknown, id: string) => ({ run: { id, status: 'accepted', mode: 'audit', input: {} }, reports: [] })),
  };
});
vi.mock('../src/services/pipeline', () => ({ pipelineData: vi.fn(async () => ({ activeRuns: st.activeRuns, automations: [], running: [], pages: [], ladderCards: [], queue: { next: [], later: [], waiting: [] } })) }));
vi.mock('../src/services/spend', () => ({ monthSpend: vi.fn(async () => 5) }));
vi.mock('../src/services/runs', () => ({
  estimateCost: vi.fn(async () => 0.12),
  findIdempotentRun: vi.fn(async () => (st.priorIdem ? { id: 'run-prior' } : null)),
  createRunWithMeta: vi.fn(async (a: { user: { id: string } }, input: Record<string, unknown>, opts: Record<string, unknown>) => {
    st.created.push({ input, opts: { ...opts, actor: a.user.id } });
    return { run: { id: st.replay ? 'run-prior' : 'run-new' }, replayed: st.replay };
  }),
}));
vi.mock('../src/routes/runs', () => ({ sendFile: vi.fn() }));

const canonicalNotices = (l: { id: string; tone: string }[]) => l.map((n) => `${n.id}:${n.tone}`);
const { apiV1Routes } = await import('../src/routes/apiV1');
const { HttpError } = await import('../src/lib/errors');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  await app.register(rateLimit, { global: false });
  app.setErrorHandler((err, _req, reply) =>
    err instanceof HttpError ? reply.status(err.statusCode).send({ ...(err.extra ?? {}), error: err.message, code: err.code, fields: err.fields }) : reply.status((err as { statusCode?: number }).statusCode ?? 500).send({ error: String(err) }),
  );
  await app.register(apiV1Routes);
});
afterAll(() => app.close());
beforeEach(() => {
  st.membership = { role: 'admin' };
  st.created = [];
  st.replay = false;
  st.priorIdem = false;
  st.activeRuns = [];
});

const post = (token: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: '/api/v1/runs', headers: { authorization: `Bearer ${token}`, ...headers }, payload: payload as object });
const audit = { mode: 'audit', websiteId: SITE_A, reportType: 'site_audit' };
const mcp = (token: string, method: string, params?: unknown) =>
  app.inject({ method: 'POST', url: '/api/v1/mcp', headers: { authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: 1, method, params } });

describe('POST /api/v1/runs', () => {
  it('starts a run with the forms’ schema, as the key’s creator, and records the key', async () => {
    const r = await post(RUN_KEY, audit);
    expect(r.statusCode).toBe(201);
    expect(r.json().run.id).toBe('run-new');
    expect(st.created).toHaveLength(1);
    expect(st.created[0]!.input).toMatchObject({ mode: 'audit', siteId: SITE_A, reportType: 'site_audit' });   // websiteId -> siteId
    expect(st.created[0]!.opts).toMatchObject({ apiKeyId: 'key-run', actor: 'user-1', idempotency: null });
  });

  it('a key without the "run" permission cannot start anything', async () => {
    const r = await post(READ_KEY, audit);
    expect([r.statusCode, r.json().code]).toEqual([403, 'scope_missing']);
    expect(st.created).toEqual([]);
  });

  it('a key whose creator left the company (or lost the role) stops starting work', async () => {
    expect((await post(ORPHAN_KEY, audit)).json().code).toBe('key_owner_gone');
    st.membership = { role: 'viewer' };
    const r = await post(RUN_KEY, audit);
    expect([r.statusCode, r.json().code]).toEqual([403, 'key_owner_gone']);
    expect(st.created).toEqual([]);
  });

  it('an unknown or malformed key is a 401, never a fallback to anything else', async () => {
    expect((await post(KEY('z'), audit)).statusCode).toBe(401);
    expect((await post('asc_short', audit)).statusCode).toBe(401);
  });

  it('validates exactly like the form (unknown mode, missing fields)', async () => {
    const a = await post(RUN_KEY, { mode: 'nonsense' });
    expect([a.statusCode, a.json().code, a.json().fields.mode]).toEqual([400, 'validation', 'Unknown mode']);
    const b = await post(RUN_KEY, { mode: 'verdict', keyword: 'x', country: 'Atlantis' });
    expect(b.statusCode).toBe(400);
    expect(Object.keys(b.json().fields)).toContain('keyword');
    expect(st.created).toEqual([]);
  });

  it('another company’s website is not found — the same answer as one that does not exist', async () => {
    const r = await post(RUN_KEY, { ...audit, websiteId: SITE_B });
    expect([r.statusCode, r.json().error]).toEqual([404, 'Website not found']);
    expect(st.created).toEqual([]);
  });

  it('the forms’ duplicate warning is a 409 until its id is acknowledged', async () => {
    st.activeRuns = [{ id: 'run-going', mode: 'audit', keyword: '', createdAt: '2026-10-17T08:00:00.000Z' }];
    const r = await post(RUN_KEY, audit);
    expect([r.statusCode, r.json().code]).toEqual([409, 'confirm_needed']);
    expect(r.json().needsAcknowledge).toEqual(['active:run-going']);
    expect(canonicalNotices(r.json().notices)).toContain('active:run-going:warning');
    expect(st.created).toEqual([]);
    // a wrong id does not pass it
    expect((await post(RUN_KEY, { ...audit, acknowledge: ['active:other'] })).statusCode).toBe(409);
    const ok = await post(RUN_KEY, { ...audit, acknowledge: ['active:run-going'] });
    expect(ok.statusCode).toBe(201);
    expect(st.created).toHaveLength(1);
  });

  it('dryRun shows the estimate, the warnings and the budget, and starts nothing', async () => {
    st.activeRuns = [{ id: 'run-going', mode: 'audit', keyword: '', createdAt: '2026-10-17T08:00:00.000Z' }];
    const r = await post(RUN_KEY, { ...audit, dryRun: true });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ dryRun: true, mode: 'audit', estimate: { usd: 0.12 }, needsAcknowledge: ['active:run-going'], budget: { spentUsd: 5, budgetUsd: 25, remainingUsd: 20 } });
    expect(st.created).toEqual([]);
  });

  it('Idempotency-Key: validated, passed under the lock with a hash of the request, and a replay says so', async () => {
    expect((await post(RUN_KEY, audit, { 'idempotency-key': 'bad key with spaces' })).statusCode).toBe(400);
    const a = await post(RUN_KEY, audit, { 'idempotency-key': 'job-42' });
    expect(a.statusCode).toBe(201);
    const idem = st.created[0]!.opts.idempotency as { key: string; hash: string };
    expect(idem.key).toBe('job-42');
    expect(idem.hash).toMatch(/^[0-9a-f]{64}$/);
    // the same request in another field order hashes the same
    await post(RUN_KEY, { reportType: 'site_audit', websiteId: SITE_A, mode: 'audit' }, { 'idempotency-key': 'job-42' });
    expect((st.created[1]!.opts.idempotency as { hash: string }).hash).toBe(idem.hash);
    st.replay = true;
    const b = await post(RUN_KEY, audit, { 'idempotency-key': 'job-42' });
    expect([b.statusCode, b.headers['idempotent-replayed'], b.json().run.id]).toEqual([200, 'true', 'run-prior']);
  });

  it('a replay is answered even when a duplicate warning has appeared since (it is the same run)', async () => {
    st.activeRuns = [{ id: 'run-prior', mode: 'audit', keyword: '', createdAt: '2026-10-17T08:00:00.000Z' }];
    st.priorIdem = true;
    st.replay = true;
    const r = await post(RUN_KEY, audit, { 'idempotency-key': 'job-42' });
    expect(r.statusCode).toBe(200);
  });
});

describe('MCP run tools', () => {
  it('tools/list shows only what the key may call', async () => {
    const names = (r: { json: () => { result: { tools: { name: string }[] } } }) => r.json().result.tools.map((t) => t.name);
    const read = names(await mcp(READ_KEY, 'tools/list'));
    expect(read).toContain('list_modes');
    expect(read).not.toContain('start_run');
    const run = names(await mcp(RUN_KEY, 'tools/list'));
    expect(run).toEqual(expect.arrayContaining(['start_run', 'preview_run', 'get_run', 'list_modes']));
    expect(run).not.toContain('publish_check');
  });

  it('start_run without the scope is a tool error, not a run', async () => {
    const r = (await mcp(READ_KEY, 'tools/call', { name: 'start_run', arguments: { input: audit } })).json();
    expect(r.result.isError).toBe(true);
    expect(st.created).toEqual([]);
  });

  it('start_run hands the duplicate warnings back to the assistant, and starts once acknowledged', async () => {
    st.activeRuns = [{ id: 'run-going', mode: 'audit', keyword: '', createdAt: '2026-10-17T08:00:00.000Z' }];
    const refused = (await mcp(RUN_KEY, 'tools/call', { name: 'start_run', arguments: { input: audit } })).json();
    expect(refused.result.isError).toBe(true);
    expect(refused.result.structuredContent).toMatchObject({ code: 'confirm_needed', needsAcknowledge: ['active:run-going'] });
    const ok = (await mcp(RUN_KEY, 'tools/call', { name: 'start_run', arguments: { input: audit, acknowledge: ['active:run-going'], idempotencyKey: 'mcp-1' } })).json();
    expect(ok.result.isError).toBe(false);
    expect(st.created[0]!.opts).toMatchObject({ idempotency: { key: 'mcp-1' } });
  });

  it('preview_run is a dry run', async () => {
    const r = (await mcp(RUN_KEY, 'tools/call', { name: 'preview_run', arguments: { input: audit } })).json();
    expect(r.result.structuredContent).toMatchObject({ dryRun: true, estimate: { usd: 0.12 } });
    expect(st.created).toEqual([]);
  });

  it('list_modes gives every mode with its input as JSON Schema', async () => {
    const r = (await mcp(READ_KEY, 'tools/call', { name: 'list_modes', arguments: {} })).json();
    const items = r.result.structuredContent.items as { mode: string; inputSchema: { properties?: Record<string, unknown> } | null }[];
    expect(items.map((i) => i.mode)).toEqual(expect.arrayContaining(['audit', 'keyword', 'ladder', 'ai_visibility']));
    expect(Object.keys(items.find((i) => i.mode === 'audit')!.inputSchema!.properties!)).toEqual(expect.arrayContaining(['mode', 'siteId']));
  });
});
