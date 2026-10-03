import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LadderRow, LadderSettingsRow } from '@seo/shared';

// The ladder controls' routes with n8n and the access checks mocked: the ladder must be one of the website's (404 otherwise, and
// nothing is written), bodies are validated, and the writes go to the website's rows only.

const n8n = vi.hoisted(() => ({
  ladders: [] as LadderRow[],
  settings: [] as LadderSettingsRow[],
  upserts: [] as { table: string; filters: unknown[]; data: Record<string, unknown> }[],
  deletes: [] as { table: string; filters: unknown[] }[],
}));

vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async () => ({ org: { id: 'org-1' }, site: { id: 'site-1', domain: 'techand.ai', verifiedAt: new Date() }, role: 'admin' })),
  requireVerified: vi.fn(),
}));
vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string) => (table === 'ladders' ? n8n.ladders : table === 'ladderSettings' ? n8n.settings : [])),
  upsertRow: vi.fn(async (table: string, filters: unknown[], data: Record<string, unknown>) => void n8n.upserts.push({ table, filters, data })),
  deleteRows: vi.fn(async (table: string, filters: unknown[]) => (n8n.deletes.push({ table, filters }), true)),
  ensureTable: vi.fn(async () => 'tbl'),
  invalidateSite: vi.fn(),
}));
vi.mock('../src/services/pipeline', () => ({
  ladderCards: vi.fn(async () => [{ id: 'lad_mine', head: 'e invoicing in uae', mode: 'manual', status: 'planning', priority: 1 }]),
}));

const { ladderRoutes } = await import('../src/routes/ladders');
const { HttpError } = await import('../src/lib/errors');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.status(err.statusCode).send({ error: err.message, fields: err.fields }) : reply.status(500).send({ error: String(err) })));
  await app.register(ladderRoutes);
});
afterAll(() => app.close());
beforeEach(() => {
  n8n.ladders = [
    { ladder_id: 'lad_mine', domain: 'techand.ai', head_keyword: 'e invoicing in uae', keyword: 'peppol uae', rung: 1, page_no: 1, start_date: '2026-10-01', status: 'planned' },
    { ladder_id: 'lad_mine', domain: 'techand.ai', head_keyword: 'e invoicing in uae', keyword: 'e invoicing in uae', rung: 4, page_no: 2, start_date: '2026-10-01', status: 'planned' },
  ] as LadderRow[];
  n8n.settings = [];
  n8n.upserts = [];
  n8n.deletes = [];
});

const base = '/api/orgs/00000000-0000-0000-0000-000000000001/sites/00000000-0000-0000-0000-000000000002';
const send = (method: 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url: base + url, payload: payload as object });

describe('ladder routes', () => {
  it('a ladder of another website (or no ladder) is a 404 and nothing is written', async () => {
    for (const r of [await send('PATCH', '/ladders/lad_other', { mode: 'manual' }), await send('DELETE', '/ladders/lad_other'), await send('PATCH', '/ladders/_site', { mode: 'manual' }), await send('PATCH', '/ladders/bad%20id', { mode: 'manual' })])
      expect(r.statusCode).toBe(404);
    expect([n8n.upserts, n8n.deletes]).toEqual([[], []]);
  });

  it('PATCH validates: Auto / Manual, Pause / Resume only (never won or stuck), something to change', async () => {
    for (const body of [{ status: 'stuck' }, { status: 'won' }, { mode: 'sometimes' }, {}]) expect((await send('PATCH', '/ladders/lad_mine', body)).statusCode).toBe(400);
    expect(n8n.upserts).toEqual([]);
  });

  it('PATCH writes the ladder’s row (filtered by ladder and domain) and answers with its card', async () => {
    const r = await send('PATCH', '/ladders/lad_mine', { mode: 'manual' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ id: 'lad_mine', mode: 'manual' });
    expect(n8n.upserts).toHaveLength(1);
    expect(n8n.upserts[0]).toMatchObject({
      table: 'ladderSettings',
      filters: [
        { columnName: 'ladder_id', condition: 'eq', value: 'lad_mine' },
        { columnName: 'domain', condition: 'eq', value: 'techand.ai' },
      ],
      data: { ladder_id: 'lad_mine', domain: 'techand.ai', site_id: 'site_techand-ai', mode: 'manual', status: 'active', priority: 1, head_keyword: 'e invoicing in uae' },
    });
  });

  it('PUT order: every ladder once; DELETE removes its pages, settings and rank checks', async () => {
    expect((await send('PUT', '/ladders/order', { ladderIds: ['lad_mine', 'lad_other'] })).statusCode).toBe(400);
    expect((await send('PUT', '/ladders/order', { ladderIds: ['lad_mine', 'lad_mine'] })).statusCode).toBe(400);
    expect((await send('PUT', '/ladders/order', { ladderIds: ['lad_mine'] })).statusCode).toBe(200);
    expect(n8n.upserts.map((u) => [u.data.ladder_id, u.data.priority])).toEqual([['lad_mine', 1]]);
    const d = await send('DELETE', '/ladders/lad_mine');
    expect(d.statusCode).toBe(204);
    expect(n8n.deletes.map((x) => x.table)).toEqual(['ladders', 'ladderSettings', 'rankHistory']);
    expect(n8n.deletes[0].filters).toEqual([
      { columnName: 'domain', condition: 'eq', value: 'techand.ai' },
      { columnName: 'ladder_id', condition: 'eq', value: 'lad_mine' },
    ]);
  });

  it('PATCH automation: ranges checked; writes the _site row', async () => {
    for (const body of [{ maxActiveLadders: 6 }, { maxWaiting: 0 }, { defaultMode: 'x' }, {}]) expect((await send('PATCH', '/automation', body)).statusCode).toBe(400);
    const r = await send('PATCH', '/automation', { maxActiveLadders: 3, opportunities: 'manual' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ defaultMode: 'auto', opportunities: 'manual', autoStartLadders: false, maxActiveLadders: 3, maxWaiting: 3 });
    expect(n8n.upserts[0]).toMatchObject({ filters: [{ value: '_site' }, { value: 'techand.ai' }], data: { ladder_id: '_site', max_active: 3, opportunities: 'manual', max_waiting: 3, mode: 'auto' } });
  });

  it('PATCH automation: "Choose keywords for me" is the _site row’s auto_start (only that column when the row exists)', async () => {
    expect((await send('PATCH', '/automation', { autoStartLadders: 'yes' })).statusCode).toBe(400);
    let r = await send('PATCH', '/automation', { autoStartLadders: true });
    expect(r.json()).toMatchObject({ autoStartLadders: true, defaultMode: 'auto', maxActiveLadders: 2 });
    expect(n8n.upserts[0].data).toMatchObject({ ladder_id: '_site', auto_start: true, mode: 'auto', max_active: 2, max_waiting: 3 });
    n8n.settings = [{ ladder_id: '_site', domain: 'techand.ai', mode: 'manual', auto_start: true, max_active: 3 } as LadderSettingsRow];
    n8n.upserts = [];
    r = await send('PATCH', '/automation', { autoStartLadders: false });
    expect(r.json()).toMatchObject({ autoStartLadders: false, defaultMode: 'manual', maxActiveLadders: 3 });
    expect(Object.keys(n8n.upserts[0].data).sort()).toEqual(['auto_start', 'updated_at']);
    expect(n8n.upserts[0].data.auto_start).toBe(false);
  });
});
