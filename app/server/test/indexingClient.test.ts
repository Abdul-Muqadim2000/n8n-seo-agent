import { afterAll, describe, expect, it, vi } from 'vitest';

// Index coverage fix wave 1 (2026-10-29): the n8n read helper as the index coverage tables use it. A20: a callback's invalidation reaches
// the reads keyed by the engine's site id (the index tables), not only those keyed by domain. A21: a table the engine has not created yet
// (the index tables before the first daily run) does not re-read the whole table list on every read. n8n is a fake fetch.

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
const calls: string[] = [];
let tables: { id: string; name: string }[] = [{ id: 't1', name: 'seo_index_runs' }];
vi.stubGlobal('fetch', async (url: string) => {
  calls.push(url);
  const body = url.includes('/data-tables?') ? { data: tables, nextCursor: null } : { data: [{ site_id: 'site_novaand-demo-com', run_at: '2026-10-29T09:00:00Z' }], nextCursor: null };
  return new Response(JSON.stringify(body), { status: 200 });
});
afterAll(() => vi.unstubAllGlobals());
const client = await import('../src/n8n/client');

describe('the n8n read helper and the index tables', () => {
  it('A20: invalidateSite(domain) also forgets the reads filtered by the engine site id', async () => {
    const q = { filters: [{ columnName: 'site_id', condition: 'eq' as const, value: 'site_novaand-demo-com' }], sortBy: 'run_at:desc', max: 5 };
    await client.rows('indexRuns', q);
    await client.rows('indexRuns', q);
    const reads = () => calls.filter((c) => c.includes('/data-tables/t1/rows')).length;
    expect(reads()).toBe(1);
    client.invalidateSite('novaand-demo.com');
    await client.rows('indexRuns', q);
    expect(reads()).toBe(2);
  });

  it('A21: a missing table is not looked for again on every read (the table list is read once, not each time)', async () => {
    const lists = () => calls.filter((c) => c.includes('/data-tables?')).length;
    const before = lists();
    for (let i = 0; i < 4; i++) expect(await client.rows('indexPages', { filters: [{ columnName: 'site_id', condition: 'eq', value: `site_x${i}` }] })).toEqual([]);
    expect(lists() - before).toBe(1);
  });
});
