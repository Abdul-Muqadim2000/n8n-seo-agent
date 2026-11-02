import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prod 2026-11-02 (devaicon.com): a page run whose engine host was preempted mid-run sat at "running" for hours. n8n marks such an
// execution `crashed` (not `error`) and keeps no items in it, so the watcher follows the front door's execution to the one it started and
// closes the run as soon as n8n says that one crashed. n8n and the database are fakes.

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});

const st = vi.hoisted(() => ({
  active: [] as { id: string; requestId: string | null; createdAt: Date }[],
  updates: [] as Record<string, unknown>[],
  work: {} as Record<string, string | null>,
  status: {} as Record<string, string | null>,
  frontDoorReads: 0,
}));

vi.mock('../src/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => st.active }) }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        st.updates.push(v);
        const where = Object.assign(Promise.resolve(undefined), { returning: async () => [{ id: 'x' }] });
        return { where: () => where };
      },
    }),
  },
  schema: { runs: { id: 'id', status: 'status', requestId: 'request_id', createdAt: 'created_at' } },
}));
vi.mock('../src/services/webhooks', () => ({ emitRunsFailed: vi.fn(async () => undefined) }));
vi.mock('../src/services/runs', () => ({ releaseFailedPages: vi.fn(async () => undefined) }));
vi.mock('../src/n8n/client', async (actual) => ({
  ...(await actual<typeof import('../src/n8n/client')>()),
  executions: async () => [],
  executionFailure: async () => null,
  subExecutionOf: async (id: string) => {
    st.frontDoorReads++;
    return st.work[id] ?? null;
  },
  executionStatus: async (id: string) => st.status[id] ?? null,
}));

const { checkEngineFailures, ENGINE_RESTART_ERROR } = await import('../src/services/engineFailures');
const { subExecutionIn } = await import('../src/n8n/client');

beforeEach(() => {
  st.active = [];
  st.updates = [];
  st.work = {};
  st.status = {};
  st.frontDoorReads = 0;
});

describe('runs whose engine execution crashed', () => {
  it('reads the execution the front door started from its node metadata', () => {
    const d = { data: { resultData: { runData: { 'Quick Validate': [{}], 'Start SEO Run': [{ metadata: { subExecution: { executionId: '4812', workflowId: 'SEOagentV4Full01' } } }] } } } };
    expect(subExecutionIn(d)).toBe('4812');
    expect(subExecutionIn({ data: { resultData: { runData: { 'Respond Bad Request': [{}] } } } })).toBeNull();
    expect(subExecutionIn({})).toBeNull();
  });

  it('closes a run at once when its work execution crashed (a VM restart), with a sentence that says so', async () => {
    st.active = [{ id: 'run-1', requestId: '4811', createdAt: new Date(Date.now() - 30 * 60_000) }];
    st.work = { '4811': '4812' };
    st.status = { '4812': 'crashed' };
    expect(await checkEngineFailures()).toBe(1);
    expect(st.updates[0].status).toBe('failed');
    expect(String(st.updates[0].error)).toContain(ENGINE_RESTART_ERROR);
    expect(String(st.updates[0].error)).toContain('4812');
  });

  it('leaves running, finished and unknown executions to the callback and the expiry, and reads each front door once', async () => {
    st.active = [
      { id: 'run-a', requestId: '10', createdAt: new Date() },
      { id: 'run-b', requestId: '20', createdAt: new Date() },
      { id: 'run-c', requestId: '30', createdAt: new Date() },
      { id: 'run-d', requestId: 'admin-7', createdAt: new Date() },
    ];
    st.work = { '10': '11', '20': '21', '30': null };
    st.status = { '11': 'running', '21': 'success' };
    expect(await checkEngineFailures()).toBe(0);
    expect(await checkEngineFailures()).toBe(0);
    expect(st.updates).toHaveLength(0);
    expect(st.frontDoorReads).toBe(3);
  });
});
