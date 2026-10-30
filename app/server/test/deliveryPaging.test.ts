import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Index coverage, fix wave 2 (REVIEW_2.md N-app-5, X10): the platform admin's delivery report counts the daily index check's fires from
// n8n's execution history. That workflow runs one execution per website a day (plus retries) next to its one scheduled fire, so the
// newest 150 executions cover only a few days and every older fire read as "missed". The history is now read by n8n's cursor until the
// oldest week shown. n8n's API is answered from memory (a fetch stub); nothing leaves the machine.

const t = vi.hoisted(() => ({ calls: [] as string[], firstRun: '' }));
vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.GENERIC_TIMEZONE = 'UTC';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return { ...real, rows: vi.fn(async (table: string) => (table === 'indexRuns' ? [{ run_at: t.firstRun }] : [])) };
});

const NOW = new Date('2026-12-10T12:00:00Z');
const SITES = 9;
/** 60 days of the daily index check: its 05:15 scheduled fire, then one execution per website and a retry, newest first */
function history(): { id: string; workflowId: string; status: string; startedAt: string; mode: string }[] {
  const out: { id: string; workflowId: string; status: string; startedAt: string; mode: string }[] = [];
  for (let d = 0; d < 60; d++) {
    const day = new Date(Date.UTC(2026, 11, 10) - d * 86_400_000);
    const at = (h: number, m: number) => new Date(day.getTime() + (h * 60 + m) * 60_000);
    if (at(5, 15) > NOW) continue;
    for (let i = SITES + 1; i >= 1; i--) out.push({ id: `${d}-${i}`, workflowId: 'SEOagentIndexCv1', status: 'success', startedAt: at(5, 15 + i * 3).toISOString(), mode: 'integrated' });
    out.push({ id: `${d}-0`, workflowId: 'SEOagentIndexCv1', status: 'success', startedAt: at(5, 15).toISOString(), mode: 'trigger' });
  }
  return out;
}

const realFetch = globalThis.fetch;
beforeAll(() => {
  const all = history();
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const u = new URL(String(input));
    t.calls.push(u.pathname + u.search);
    if (!u.pathname.endsWith('/executions')) return new Response('{}', { status: 404 });
    const wf = u.searchParams.get('workflowId');
    const status = u.searchParams.get('status');
    const limit = Number(u.searchParams.get('limit') ?? 100);
    const start = Number(u.searchParams.get('cursor') ?? 0);
    const list = wf === 'SEOagentIndexCv1' && status === 'success' ? all : [];
    const page = list.slice(start, start + limit);
    const next = start + limit < list.length ? String(start + limit) : null;
    return new Response(JSON.stringify({ data: page, nextCursor: next }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const { loadDeliveryReport } = await import('../src/services/delivery');
const { executionsSince } = await import('../src/n8n/client');

describe('N-app-5: the daily index check\'s fires are counted over the whole window, whatever its per-website executions', () => {
  it('no fire of the 42 days shown is "missed" when every one ran', async () => {
    t.firstRun = '2026-10-20T05:20:00.000Z';
    const r = await loadDeliveryReport(NOW);
    const missed = r.weeks.flatMap((w) => w.missed).filter((m) => m.workflow === 'SEOagentIndexCv1');
    expect(missed).toEqual([]);
    const fires = r.weeks.reduce((s, w) => s + w.scheduled.started, 0);
    expect(fires).toBeGreaterThan(30);
  });

  it('pages through n8n\'s cursor and stops at the oldest day asked for', async () => {
    const r = await executionsSince('SEOagentIndexCv1', 'success', new Date('2026-12-01T00:00:00Z'), { pageSize: 25 });
    expect(r.complete).toBe(true);
    expect(r.list.filter((e) => e.mode === 'trigger')).toHaveLength(10);
    expect(r.list.every((e) => Date.parse(e.startedAt) >= Date.parse('2026-12-01T00:00:00Z'))).toBe(true);
    const capped = await executionsSince('SEOagentIndexCv1', 'success', new Date('2026-10-01T00:00:00Z'), { pageSize: 10, maxPages: 2 });
    expect(capped).toMatchObject({ complete: false });
    expect(capped.list).toHaveLength(20);
  });
});
