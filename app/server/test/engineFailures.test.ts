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
  stopped: {} as Record<string, number>,
  handoff: {} as Record<string, string[]>,
  missing: [] as string[],
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
    if (st.missing.includes(id)) throw new (await import('../src/lib/errors')).HttpError(502, `n8n API /executions/${id} answered 404`, 'n8n_not_found');
    return st.work[id] ?? null;
  },
  subExecutionsOf: async (id: string) => st.handoff[id] ?? [],
  // a status in the map = n8n's answer; missing = 404 (null); not in the map, or null = n8n could not be asked (undefined)
  executionState: async (id: string) => (st.missing.includes(id) ? null : st.status[id] ? { status: st.status[id]!, stoppedAt: st.stopped[id] ?? null } : undefined),
}));

const { checkEngineFailures, ENGINE_RESTART_ERROR, ENGINE_RESTART_RETRIED, ENGINE_LOST_ERROR, ENGINE_LOST_RETRIED, ENGINE_NO_WORK_ERROR, ENGINE_NO_WORK_RETRIED, __test } = await import('../src/services/engineFailures');
const { subExecutionIn } = await import('../src/n8n/client');

// the stored input of the production run, as it is in `runs.input`
const pageInput = { cta: '', goal: 'leads', mode: 'keyword', tone: 'Professional and direct', siteId: '65ee2d24-ac16-4e03-a931-ab0aac76ad29', country: 'Pakistan', keyword: 'banking & financial services technology', business: '', pageType: 'Service Page', videoUrl: '', emailCopy: false, localArea: '', acknowledged: ['pileup:banking financial services technology'], businessFacts: '', receiveReport: true, receiveContent: true, checkPageExists: false, existingPageUrl: 'https://devaicon.com/industries/bfsi', videoTranscript: '' };
// 20 minutes old with a 15-minute estimate: not overdue yet (overdue = 3 x 15 = 45 minutes)
const run = (id: string, requestId: string, over: Partial<Row> = {}): Row => ({ id, requestId, status: 'accepted', mode: 'keyword', orgId: 'o1', userId: 'u1', siteId: 's1', etaMinutes: 15, reportCount: 0, createdAt: new Date(Date.now() - 20 * 60_000), input: { ...pageInput }, ...over });

beforeEach(() => {
  st.active = [];
  st.expired = [];
  st.newer = [];
  st.updates = [];
  st.claimOk = true;
  st.work = {};
  st.status = {};
  st.stopped = {};
  st.handoff = {};
  st.missing = [];
  st.frontDoorReads = 0;
  st.started = [];
  __test.workOf.clear();
  __test.handedTo.clear();
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

  it('prod 2026-11-04 (devaicon.com): a front door cut off before it started the work is closed and started again', async () => {
    st.active = [run('pub-1', '8255', { mode: 'published', input: { mode: 'published', siteId: '65ee2d24-ac16-4e03-a931-ab0aac76ad29', keyword: 'banking & financial services technology', emailCopy: false, publishedUrl: 'https://devaicon.example/services/industries-bfsi', confirmMismatch: false, contentRequestId: '6661' } })];   // the stored input of the stuck run
    st.work = { '8255': null };
    st.status = { '8255': 'crashed' };
    expect(await checkEngineFailures()).toBe(1);
    expect(String(st.updates[0]!.error)).toContain(ENGINE_RESTART_ERROR);
    expect(st.started).toHaveLength(1);
    expect(st.started[0]!.input).toMatchObject({ mode: 'published', keyword: 'banking & financial services technology' });
  });

  it('a front door still answering is asked again next sweep; one that finished without starting work is left alone', async () => {
    st.active = [run('door-1', '9001'), run('door-2', '9002')];
    st.work = { '9001': null, '9002': null };
    st.status = { '9001': 'running', '9002': 'success' };
    expect(await checkEngineFailures()).toBe(0);
    st.status = { '9001': 'crashed', '9002': 'success' };
    expect(await checkEngineFailures()).toBe(1);   // the door that was still going is read again, and was cut off
    expect(st.started).toHaveLength(1);
    expect(st.frontDoorReads).toBe(3);   // door-2 is remembered after its first read
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
    st.status = { '101': 'running', '201': 'success', '300': 'success' };   // 300: a front door that finished without starting work
    expect(await checkEngineFailures()).toBe(0);
    expect(await checkEngineFailures()).toBe(0);
    expect(st.updates).toHaveLength(0);
    expect(st.started).toHaveLength(0);
    expect(st.frontDoorReads).toBe(3);
  });
});

// Prod 2026-11-05 (devaicon.com): the 2026-11-04 publish check, "about 1 min", read "Queued in the SEO engine" for 69 minutes. Every way a
// run can go quiet other than "crashed" waited for the 3-hour expiry. Once overdue (3 x its estimate, never under 10 minutes), the chain
// is read: still going = left alone; ended with nothing received after a 10-minute grace = closed with what is known.
describe('runs that went quiet without a crash', () => {
  const pubInput = { mode: 'published', siteId: '65ee2d24-ac16-4e03-a931-ab0aac76ad29', keyword: 'banking & financial services technology', emailCopy: false, publishedUrl: 'https://devaicon.example/industries/bfsi', confirmMismatch: false, contentRequestId: '6661' };
  const ago = (m: number) => Date.now() - m * 60_000;
  // the screenshot's run: a one-minute publish check accepted 69 minutes ago
  const pub = (id: string, door: string, over: Partial<Row> = {}) => run(id, door, { mode: 'published', etaMinutes: 1, createdAt: new Date(ago(69)), input: { ...pubInput }, ...over });

  it('a finished publish check whose result never arrived is closed and started again (free and quick)', async () => {
    st.active = [pub('p1', '8255')];
    st.work = { '8255': '8256' };
    st.status = { '8256': 'success' };
    st.stopped = { '8256': ago(68) };
    expect(await checkEngineFailures()).toBe(1);
    expect(st.updates[0]).toMatchObject({ status: 'failed' });
    expect(String(st.updates[0]!.error)).toContain(ENGINE_LOST_ERROR);
    expect(st.started).toHaveLength(1);
    expect(st.started[0]!.input).toMatchObject({ mode: 'published', publishedUrl: pubInput.publishedUrl });
    expect(String(st.updates.at(-1)?.error)).toContain(ENGINE_LOST_RETRIED);
  });

  it('a paid page run whose result was lost is closed but never run twice by itself', async () => {
    st.active = [run('k1', '500', { createdAt: new Date(ago(60)), etaMinutes: 15 })];
    st.work = { '500': '501' };
    st.status = { '501': 'success' };
    st.stopped = { '501': ago(20) };
    expect(await checkEngineFailures()).toBe(1);
    expect(String(st.updates[0]!.error)).toContain(ENGINE_LOST_ERROR);
    expect(st.started).toHaveLength(0);
  });

  it('waits: before the run is overdue, within the grace after the work ended, and for a run that already received reports', async () => {
    st.work = { '600': '601', '610': '611', '620': '621' };
    st.status = { '601': 'success', '611': 'success', '621': 'success' };
    st.stopped = { '601': ago(4), '611': ago(3), '621': ago(30) };
    st.active = [
      pub('early', '600', { createdAt: new Date(ago(5)) }), // 5 minutes: the 10-minute floor is not reached
      pub('grace', '610'), // overdue, but the work ended 3 minutes ago: its result may still be on the way
      run('ladder', '620', { mode: 'ladder', status: 'running', reportCount: 2, createdAt: new Date(ago(200)), etaMinutes: 20 }), // a ladder that delivered pages
    ];
    expect(await checkEngineFailures()).toBe(0);
    expect(st.updates).toHaveLength(0);
    // the grace passes: the second one is closed on a later sweep without asking the front door again
    st.stopped['611'] = ago(11);
    expect(await checkEngineFailures()).toBe(1);
    expect(st.frontDoorReads).toBe(3);
  });

  it('a front door that ended without starting the work, or that n8n has no record of, is closed and started again once overdue', async () => {
    st.work = { '700': null };
    st.status = { '700': 'success' };
    st.stopped = { '700': ago(68) };
    st.missing = ['710'];
    st.active = [pub('d1', '700'), pub('d2', '710')];
    expect(await checkEngineFailures()).toBe(2);
    expect(String(st.updates[0]!.error)).toContain(ENGINE_NO_WORK_ERROR);
    expect(st.updates.map((u) => String(u.error))).toEqual(expect.arrayContaining([expect.stringContaining(ENGINE_NO_WORK_RETRIED)]));
    expect(st.started).toHaveLength(2);
  });

  it('follows work handed on to another workflow: still going = left alone, cut off = closed and started again', async () => {
    const ai = { mode: 'ai_visibility', siteId: '65ee2d24-ac16-4e03-a931-ab0aac76ad29', country: 'Pakistan', topics: [], competitors: [], emailCopy: false };
    st.active = [run('ai1', '800', { mode: 'ai_visibility', etaMinutes: 5, createdAt: new Date(ago(40)), input: { ...ai } })];
    st.work = { '800': '801' };
    st.status = { '801': 'success', '802': 'running' };
    st.stopped = { '801': ago(39) };
    st.handoff = { '801': ['802'] };
    expect(await checkEngineFailures()).toBe(0); // the AI Visibility Tracker is still asking the engines
    st.status['802'] = 'crashed';
    expect(await checkEngineFailures()).toBe(1);
    expect(String(st.updates[0]!.error)).toContain(ENGINE_RESTART_ERROR);
    expect(String(st.updates[0]!.error)).toContain('802');
    expect(st.started).toHaveLength(1);
    expect(st.started[0]!.input).toMatchObject({ mode: 'ai_visibility' });
  });

  it('P1 (2026-11-12): follows a page run that waited for a writing slot through every execution it handed its wait to', async () => {
    // 1001 waited 40 min and handed off to 1002, which handed off to 1003: the page is being written in 1003
    st.active = [run('ps1', '1000', { etaMinutes: 20, createdAt: new Date(ago(130)) })];
    st.work = { '1000': '1001' };
    st.status = { '1001': 'success', '1002': 'success', '1003': 'running' };
    st.stopped = { '1001': ago(90), '1002': ago(48) };
    st.handoff = { '1001': ['1002'], '1002': ['1003'] };
    expect(await checkEngineFailures()).toBe(0); // overdue on its first estimate, but its page is being written: left alone
    expect(st.updates).toHaveLength(0);
    st.status['1003'] = 'canceled'; // the end of the chain was cut off: closed, naming the execution that was
    expect(await checkEngineFailures()).toBe(1);
    expect(String(st.updates[0]!.error)).toContain(ENGINE_RESTART_ERROR);
    expect(String(st.updates[0]!.error)).toContain('1003');
  });

  it('an overdue run whose work ended in an error is closed with that error and not repeated', async () => {
    st.active = [pub('e1', '900')];
    st.work = { '900': '901' };
    st.status = { '901': 'error' };
    st.stopped = { '901': ago(60) };
    expect(await checkEngineFailures()).toBe(1);
    expect(String(st.updates[0]!.error)).toMatch(/^The SEO engine stopped with an error/);
    expect(st.started).toHaveLength(0);
  });

  it('never takes n8n being unreachable for an answer', async () => {
    st.active = [pub('u1', '950'), pub('u2', '960')];
    st.work = { '950': '951', '960': '961' };
    st.status = { '961': 'success' }; // 951 cannot be read; 961 ended but its hand-off cannot be read
    st.handoff = { '961': ['962'] };
    expect(await checkEngineFailures()).toBe(0);
    expect(st.updates).toHaveLength(0);
  });
});
