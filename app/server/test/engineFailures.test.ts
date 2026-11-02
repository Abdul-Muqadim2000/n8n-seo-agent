import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prod 2026-11-02 (devaicon.com): a page run whose engine host was preempted mid-run sat at "running" for hours. n8n marks such an
// execution `crashed` (not `error`) and keeps no items in it, so the watcher follows the front door's execution to the one it started,
// closes the run as soon as n8n says that one crashed, and starts it again for the person, once. n8n and the database are fakes.

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});

type Row = Record<string, unknown> & { id: string; status: string; input: Record<string, unknown> };
const st = vi.hoisted(() => ({
  active: [] as Row[],
  expired: [] as Row[],
  newer: [] as { id: string }[],
  updates: [] as Record<string, unknown>[],
  claimOk: true,
  work: {} as Record<string, string | null>,
  status: {} as Record<string, string | null>,
  frontDoorReads: 0,
  started: [] as { input: Record<string, unknown>; opts: Record<string, unknown> }[],
}));

vi.mock('../src/db', () => {
  let selects = 0;
  const select = (cols?: unknown) => ({
    from: () => ({
      where: () => {
        if (cols) return { limit: async () => st.newer }; // "did the person start it again"
        selects++;
        return Promise.resolve(selects % 2 === 1 ? st.active : st.expired);
      },
    }),
  });
  return {
    db: {
      select,
      update: () => ({
        set: (v: Record<string, unknown>) => {
          st.updates.push(v);
          const isClaim = v.input !== undefined && v.error === undefined && v.status === undefined && st.updates.filter((u) => u.input !== undefined).length === 1;
          const where = Object.assign(Promise.resolve(undefined), { returning: async () => (isClaim && !st.claimOk ? [] : [{ id: 'x' }]) });
          return { where: () => where };
        },
      }),
      query: {
        users: { findFirst: async () => ({ id: 'u1' }) },
        organizations: { findFirst: async () => ({ id: 'o1' }) },
        memberships: { findFirst: async () => ({ role: 'owner' }) },
      },
    },
    schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, k) => String(k) }) }),
  };
});
vi.mock('../src/services/webhooks', () => ({ emitRunsFailed: vi.fn(async () => undefined) }));
vi.mock('../src/services/runs', () => ({
  STALE_RUN_ERROR: 'stale',
  releaseFailedPages: vi.fn(async () => 1),
  createRunWithMeta: vi.fn(async (_a: unknown, input: Record<string, unknown>, opts: Record<string, unknown>) => {
    st.started.push({ input, opts });
    return { run: { id: 'run-new', status: 'accepted' } };
  }),
}));
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

const { checkEngineFailures, ENGINE_RESTART_ERROR, ENGINE_RESTART_RETRIED } = await import('../src/services/engineFailures');
const { subExecutionIn } = await import('../src/n8n/client');

// the stored input of the production run, as it is in `runs.input`
const pageInput = { cta: '', goal: 'leads', mode: 'keyword', tone: 'Professional and direct', siteId: '65ee2d24-ac16-4e03-a931-ab0aac76ad29', country: 'Pakistan', keyword: 'banking & financial services technology', business: '', pageType: 'Service Page', videoUrl: '', emailCopy: false, localArea: '', acknowledged: ['pileup:banking financial services technology'], businessFacts: '', receiveReport: true, receiveContent: true, checkPageExists: false, existingPageUrl: 'https://devaicon.com/industries/bfsi', videoTranscript: '' };
const run = (id: string, requestId: string, over: Partial<Row> = {}): Row => ({ id, requestId, status: 'accepted', mode: 'keyword', orgId: 'o1', userId: 'u1', siteId: 's1', createdAt: new Date(Date.now() - 20 * 60_000), input: { ...pageInput }, ...over });

beforeEach(() => {
  st.active = [];
  st.expired = [];
  st.newer = [];
  st.updates = [];
  st.claimOk = true;
  st.work = {};
  st.status = {};
  st.frontDoorReads = 0;
  st.started = [];
});

describe('runs whose engine execution crashed', () => {
  it('reads the execution the front door started from its node metadata', () => {
    const d = { data: { resultData: { runData: { 'Quick Validate': [{}], 'Start SEO Run': [{ metadata: { subExecution: { executionId: '4812', workflowId: 'SEOagentV4Full01' } } }] } } } };
    expect(subExecutionIn(d)).toBe('4812');
    expect(subExecutionIn({ data: { resultData: { runData: { 'Respond Bad Request': [{}] } } } })).toBeNull();
    expect(subExecutionIn({})).toBeNull();
  });

  it('closes a crashed page run at once and starts it again for the person, with the answers they gave', async () => {
    st.active = [run('run-1', '4811')];
    st.work = { '4811': '4812' };
    st.status = { '4812': 'crashed' };
    expect(await checkEngineFailures()).toBe(1);
    expect(st.updates[0]).toMatchObject({ status: 'failed' });
    expect(String(st.updates[0].error)).toContain(ENGINE_RESTART_ERROR);
    expect(st.started).toHaveLength(1);
    expect(st.started[0].input).toMatchObject({ mode: 'keyword', keyword: pageInput.keyword, existingPageUrl: pageInput.existingPageUrl });
    expect(st.started[0].input).not.toHaveProperty('acknowledged');
    expect(st.started[0].opts).toMatchObject({ warnings: [], acknowledge: pageInput.acknowledged, startedBy: 'person' });
    expect(String(st.updates.at(-1)?.error)).toContain(ENGINE_RESTART_RETRIED);
  });

  it('starts again a run the 3-hour expiry already closed (devaicon.com, 2026-11-02)', async () => {
    st.expired = [run('run-2', '6568', { status: 'failed', error: 'stale' })];
    st.work = { '6568': '6569' };
    st.status = { '6569': 'crashed' };
    expect(await checkEngineFailures()).toBe(0);
    expect(st.started).toHaveLength(1);
  });

  it('never starts it twice: not after a retry, not when the claim is taken, not when the person already did', async () => {
    st.work = { '1': '2', '3': '4', '5': '6' };
    st.status = { '2': 'crashed', '4': 'crashed', '6': 'crashed' };
    st.expired = [run('a', '1', { status: 'failed', input: { ...pageInput, retryOf: 'z' } }), run('b', '3', { status: 'failed', input: { ...pageInput, retryClaimed: 'x' } })];
    await checkEngineFailures();
    expect(st.started).toHaveLength(0);
    st.expired = [run('c', '5', { status: 'failed' })];
    st.newer = [{ id: 'mine' }];
    await checkEngineFailures();
    expect(st.started).toHaveLength(0);
    st.newer = [];
    st.claimOk = false;
    st.updates = [];
    await checkEngineFailures();
    expect(st.started).toHaveLength(0);
  });

  it('closes but never repeats a ladder, a free run or a run someone cancelled in n8n', async () => {
    st.work = { '10': '11', '20': '21', '30': '31' };
    st.status = { '11': 'crashed', '21': 'crashed', '31': 'canceled' };
    st.active = [run('l', '10', { mode: 'ladder' }), run('f', '20', { input: { ...pageInput, freeResearch: true } }), run('c', '30')];
    expect(await checkEngineFailures()).toBe(3);
    expect(st.started).toHaveLength(0);
  });

  it('leaves running, finished and unknown executions to the callback and the expiry, and reads each front door once', async () => {
    st.active = [run('a', '100'), run('b', '200'), run('c', '300'), run('d', 'admin-7')];
    st.work = { '100': '101', '200': '201', '300': null };
    st.status = { '101': 'running', '201': 'success' };
    expect(await checkEngineFailures()).toBe(0);
    expect(await checkEngineFailures()).toBe(0);
    expect(st.updates).toHaveLength(0);
    expect(st.started).toHaveLength(0);
    expect(st.frontDoorReads).toBe(3);
  });
});
