import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiVisibilityRow } from '@seo/shared';

// F3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md): the server halves of A1 A4 A6 A9 A10 A11 A12 A15 A20,
// against a mocked n8n (Data Tables by table name) and a mocked credit ledger.

const st = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; q: Record<string, unknown> }[],
  deleted: [] as string[],
  failDelete: '' as string,
  charges: [] as { at: string; credits: number }[],
  report: null as null | { report: { receivedAt: string }; payload: Record<string, unknown> },
}));

vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string, _domain: string, q: Record<string, unknown> = {}) => {
    st.calls.push({ table, q });
    const rows = st.tables[table] ?? [];
    const sort = String(q.sortBy ?? '');
    const sorted = sort.endsWith(':desc') ? [...rows].sort((a, b) => String(b[sort.split(':')[0]]).localeCompare(String(a[sort.split(':')[0]]))) : rows;
    return sorted.slice(0, Number(q.max ?? 2000));
  }),
  deleteRows: vi.fn(async (table: string) => {
    if (table === st.failDelete) throw new Error('n8n down');
    st.deleted.push(table);
    return true;
  }),
  rows: vi.fn(async () => []),
  insertRows: vi.fn(), ensureTable: vi.fn(), invalidateSite: vi.fn(), siteAdmin: vi.fn(), upsertRow: vi.fn(), updateRows: vi.fn(),
}));
vi.mock('../src/services/runs', async (orig) => ({ ...(await orig<typeof import('../src/services/runs')>()), latestReport: vi.fn(async () => st.report) }));
vi.mock('../src/services/runCredits', async (orig) => ({ ...(await orig<typeof import('../src/services/runCredits')>()), aiChargeEntries: vi.fn(async () => st.charges) }));

const { aiData, reportIsFor, toAiAnswer } = await import('../src/services/data');
const { bucketAiCharges } = await import('../src/services/runCredits');
const { attributeLedgerRow } = await import('../src/services/admin/costSync');
const { clearAiInEngine, adminAuditDetails, AI_TABLES_CLEARED_ON_DELETE } = await import('../src/routes/sites');

const org = { id: '00000000-0000-0000-0000-000000000001' } as never;
const site = { id: 'site-1', domain: 'techand.ai' } as never;
const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `site_techand-ai:q${from + i}`);
const engines = JSON.stringify({ chatgpt: { asked: 5, answered: 5 }, perplexity: { asked: 5, answered: 5 }, claude: { asked: 5, answered: 5, carried: true } });
const vis = (over: Partial<AiVisibilityRow>): Record<string, unknown> => ({
  site_id: 'site_techand-ai', domain: 'techand.ai', run_id: 'ai_20261019_techand.ai', checked_at: '2026-10-19T07:00:00.000Z', prompts: 99, answers: 400, samples: 400,
  mention_rate: 3.1, citation_rate: 1, share_of_voice: 4, avg_rank: 2, aio_presence: 10, aio_citation_rate: 0, engines_json: engines, competitors_json: '[]', sources_json: '[]',
  pages_json: '[]', gaps_json: '[]', market_json: '', cost_usd: 4.61, alerts: '', run_kind: 'weekly', panel_json: JSON.stringify({ ids: ids(98), size: 98, setting: 100 }), ...over,
});

beforeEach(() => {
  st.tables = {};
  st.calls = [];
  st.deleted = [];
  st.failDelete = '';
  st.charges = [];
  st.report = null;
});

describe('A1: no delta across a changed panel', () => {
  it('8 questions then 99: the latest run is not compared and says why; old rows are never subtracted blindly', async () => {
    st.tables.aiVisibility = [
      vis({ run_id: 'ai_20261012_techand.ai', checked_at: '2026-10-12T07:00:00.000Z', prompts: 8, mention_rate: 7.6, panel_json: JSON.stringify({ ids: ids(7), size: 7 }) }),
      vis({}),
    ];
    const d = await aiData(org, site);
    const L = d.runs[d.runs.length - 1];
    expect(L.compare?.comparable).toBe(false);
    expect(L.compare?.reason).toMatch(/different panel/);
    expect(L.compare?.metrics.named_rate).toBeUndefined();
  });
  it('the engine\'s compare_json wins over the app\'s rule', async () => {
    st.tables.aiVisibility = [vis({ checked_at: '2026-10-12T07:00:00.000Z' }), vis({ compare_json: JSON.stringify({ comparable: true, window: { from: '2026-10-12', to: '2026-10-19', days: 7 }, metrics: { named_rate: { now: 3.1, prev: 3.1, delta: 0, significant: false } } }) })];
    const L = (await aiData(org, site)).runs[1];
    expect(L.compare?.source).toBe('engine');
    expect(L.compare?.window?.days).toBe(7);
  });
});

describe('A4: the engine\'s separators', () => {
  it('alerts split on " | " with their level; our cited pages split on spaces', async () => {
    st.tables.aiVisibility = [vis({ alerts: 'high: AI states something wrong about you (ChatGPT, Gemini): x | medium: wafeq.com gained 12 points' })];
    st.tables.aiAnswers = [{ run_id: 'ai_20261019_techand.ai', checked_at: '2026-10-19T07:05:00.000Z', prompt_id: 'q1', engine: 'chatgpt', answered: true, mentioned: true, cited: true, rank: 2, our_urls: 'https://techand.ai/a https://techand.ai/b' }];
    const d = await aiData(org, site);
    expect(d.runs[0].alerts).toEqual(['AI states something wrong about you (ChatGPT, Gemini): x', 'wafeq.com gained 12 points']);
    expect(d.runs[0].alertItems.map((a) => a.level)).toEqual(['high', 'medium']);
    expect(d.answers[0].ourUrls).toEqual(['https://techand.ai/a', 'https://techand.ai/b']);
  });
  it('the 2026-10-23 answer fields: cited as a URL, position, entities (only competitors are rivals)', () => {
    const a = toAiAnswer({ prompt_id: 'q', engine: 'chatgpt', answered: true, mentioned: false, named: 'Techand', cited: 'https://techand.ai/x', rank: 0, position: 3, our_urls: '', competitors: 'old.com',
      entities: JSON.stringify([{ id: 'wafeq.com', name: 'Wafeq', role: 'competitor', position: 1 }, { id: 'g2.com', name: 'G2', role: 'source' }, { id: 'techand.ai', name: 'Techand', role: 'self', position: 3 }]) } as never);
    expect(a.mentioned).toBe(true);
    expect(a.cited).toBe(true);
    expect(a.ourUrls).toEqual(['https://techand.ai/x']);
    expect(a.position).toBe(3);
    expect(a.competitors).toEqual(['Wafeq']);
  });
});

describe('A6: report blocks belong to the run they sit beside', () => {
  it('a report of another run is not current', async () => {
    st.tables.aiVisibility = [vis({})];
    st.report = { report: { receivedAt: '2026-09-28T08:00:00.000Z' }, payload: { run_id: 'ai_20260928_techand.ai', brief: { headline: 'old' }, questions: [{ prompt_id: 'q', win_rate: 0, samples: 3, win: { ci: [0, 56], enough: false, why: 'x' } }] } };
    const d = await aiData(org, site);
    expect(d.report?.current).toBe(false);
    // A15: the engine's own verdict on the question passes through
    expect(d.report?.questions[0].win).toEqual({ ci: [0, 56], enough: false, why: 'x' });
  });
  it('the rule: same run id and after its start; without an id, within two days', () => {
    expect(reportIsFor('ai_1', '2026-10-19T08:00:00Z', 'ai_1', '2026-10-19T07:00:00Z')).toBe(true);
    expect(reportIsFor('ai_1', '2026-10-19T06:00:00Z', 'ai_1', '2026-10-19T07:00:00Z')).toBe(false);   // the first run of that day
    expect(reportIsFor('ai_0', '2026-10-19T08:00:00Z', 'ai_1', '2026-10-19T07:00:00Z')).toBe(false);
    expect(reportIsFor('', '2026-10-20T08:00:00Z', 'ai_1', '2026-10-19T07:00:00Z')).toBe(true);
    expect(reportIsFor('', '2026-10-25T08:00:00Z', 'ai_1', '2026-10-19T07:00:00Z')).toBe(false);
  });
});

describe('A10 / A11: read limits and what each caller reads', () => {
  it('301 stored runs: the newest is the latest (read newest first, then put in order)', async () => {
    st.tables.aiVisibility = Array.from({ length: 301 }, (_, i) => vis({ run_id: `r${i}`, checked_at: new Date(Date.UTC(2020, 0, 1) + i * 7 * 864e5).toISOString() }));
    const d = await aiData(org, site);
    expect(d.runs).toHaveLength(300);
    expect(d.runs[d.runs.length - 1].runId).toBe('r300');
    expect(st.calls.find((c) => c.table === 'aiVisibility')?.q.sortBy).toBe('checked_at:desc');
    const a = st.calls.find((c) => c.table === 'aiAnswers')!;
    expect(a.q).toMatchObject({ sortBy: 'checked_at:desc' });
    expect(Number(a.q.max)).toBeGreaterThanOrEqual(4500);
  });
  it('the Overview / Recommendations / segments read never loads the answers', async () => {
    st.tables.aiVisibility = [vis({})];
    await aiData(org, site, { answers: false });
    expect(st.calls.some((c) => c.table === 'aiAnswers')).toBe(false);
  });
  it('A3: the panel size set now comes from the monitors row; none = null (the engine then asks 50)', async () => {
    st.tables.monitors = [{ site_id: 'site_techand-ai', domain: 'techand.ai', ai_prompts_max: 50 }];
    expect((await aiData(org, site)).promptsMax).toBe(50);
    st.tables.monitors = [];
    expect((await aiData(org, site)).promptsMax).toBeNull();
  });
});

describe('A9: credits per run are what the ledger charged', () => {
  it('ledger entries go to the run that started before them; no entry = no figure', async () => {
    st.tables.aiVisibility = [vis({ checked_at: '2026-10-12T07:00:00.000Z' }), vis({})];
    st.charges = [{ at: '2026-10-19T07:40:00.000Z', credits: 9 }, { at: '2026-10-19T09:10:00.000Z', credits: 3.4 }];
    const d = await aiData(org, site);
    expect(d.runs.map((r) => r.credits)).toEqual([null, 12.4]);
  });
  it('bucketAiCharges: slack before a run start, nothing before the first run', () => {
    const runs = [{ checkedAt: '2026-10-12T07:00:00Z' }, { checkedAt: '2026-10-19T07:00:00Z' }];
    expect(bucketAiCharges(runs, [{ at: '2026-10-19T06:45:00Z', credits: 2 }, { at: '2026-10-01T00:00:00Z', credits: 5 }, { at: '2026-10-13T00:00:00Z', credits: 1 }])).toEqual([1, 2]);
  });
});

describe('A12: a deleted website takes its AI inputs and history with it', () => {
  const log = { warn: vi.fn() } as never;
  it('deletes the monitors, the panel and the AI history of the domain, table by table', async () => {
    expect(await clearAiInEngine('techand.ai', log)).toEqual([]);
    expect(st.deleted).toEqual([...AI_TABLES_CLEARED_ON_DELETE]);
    expect(st.deleted).toEqual(expect.arrayContaining(['monitors', 'aiPrompts', 'aiVisibility', 'aiAnswers', 'aiDaily', 'aiImports']));
  });
  it('one table failing does not stop the others', async () => {
    st.failDelete = 'aiPrompts';
    expect(await clearAiInEngine('techand.ai', log)).toEqual(['aiPrompts']);
    expect(st.deleted).toContain('aiDaily');
  });
});

describe('A13: the audit details of a panel edit carry counts and ids, never question texts', () => {
  it('ai_prompts', () => {
    const d = adminAuditDetails({ action: 'ai_prompts', add: ['Which ERP partner fits a retailer in Riyadh?'], remove: ['p1'], enable: [], pin: ['p2'], unpin: [], edit: [{ promptId: 'p3', prompt: 'secret wording?' }] } as never, 3);
    expect(d).toMatchObject({ added: 1, removed: 1, pinned: 1, edited: 1, ids: ['p3', 'p1', 'p2'] });
    expect(JSON.stringify(d)).not.toMatch(/Riyadh|secret wording/);
  });
  it('monitors: the panel size and engines that changed', () => {
    expect(adminAuditDetails({ action: 'monitors', monitors: { aiPromptsMax: 50, aiEngines: ['chatgpt'] } } as never, 1)).toMatchObject({ aiPromptsMax: 50, aiEngines: ['chatgpt'], changed: ['aiPromptsMax', 'aiEngines'] });
  });
});

describe('A20: a split run is attributed to its on-demand run however long the parent chain', () => {
  it('the 7th part of a 7-execution run reaches the run, and a cycle stops', () => {
    const ORG = '11111111-1111-4111-8111-111111111111';
    const lk = { runsByExec: new Map([['e1', { id: 'run-1', orgId: ORG, siteId: 's', userId: 'u' }]]), sitesByDomain: new Map(), sitesByEngineId: new Map(), orgs: new Map([[ORG, new Date('2026-01-01')]]), stored: new Map() } as never;
    const at = '2026-10-19T12:00:00Z';
    const batch = new Map(Array.from({ length: 6 }, (_, i) => [`e${i + 2}`, { run_id: `e${i + 2}`, key: `parent:e${i + 1}`, mode: 'ai_visibility', settled_at: at }]));
    expect(attributeLedgerRow(batch.get('e7')!, lk, batch).runId).toBe('run-1');
    const loop = new Map([['x1', { run_id: 'x1', key: 'parent:x2', settled_at: at }], ['x2', { run_id: 'x2', key: 'parent:x1', settled_at: at }]]);
    expect(attributeLedgerRow(loop.get('x1')!, lk, loop).orgId).toBeNull();
  });
});
